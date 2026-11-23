"""Generate Tagalog or Vietnamese glosses from the existing English study data."""

import argparse
import csv
import hashlib
import json
import re
import shutil
from pathlib import Path, PurePosixPath
from unicodedata import normalize
from zipfile import ZipFile

import ctranslate2
import sentencepiece


ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache" / "study-translation"
LEVELS = (5, 4, 3, 2, 1)
LANGUAGES = {"tl": "Tagalog", "vi": "Vietnamese"}
OVERRIDES_FILE = ROOT / "scripts" / "study-translation-overrides.json"


def read_json(file):
    return json.loads(file.read_text(encoding="utf-8"))


def read_english_vocabulary():
    for level in LEVELS:
        filename = f"n{level}_vocab_cleaned.csv"
        source = ROOT / "Data" / "Vocabulary" / "English" / filename
        with source.open(encoding="utf-8-sig", newline="") as file:
            reader = csv.reader(file)
            next(reader)
            rows = [
                (row[0].strip(), row[1].strip(), ", ".join(row[2:]).strip())
                for row in reader if any(row)
            ]
        yield filename, rows


def prepare_model(archive_path, language):
    with archive_path.open("rb") as file:
        archive_id = hashlib.file_digest(file, "sha256").hexdigest()[:16]
    model = CACHE / f"en-{language}-{archive_id}"

    with ZipFile(archive_path) as archive:
        metadata_name = next(
            entry for entry in archive.namelist()
            if PurePosixPath(entry).name == "metadata.json"
        )
        metadata = json.loads(archive.read(metadata_name))
        if (metadata["from_code"], metadata["to_code"]) != ("en", language):
            raise ValueError(f"Expected an English to {LANGUAGES[language]} Argos package.")
        base = PurePosixPath(metadata_name).parent
        for entry in archive.infolist():
            member = PurePosixPath(entry.filename)
            if entry.is_dir() or not member.is_relative_to(base):
                continue
            relative = member.relative_to(base)
            model_file = (
                len(relative.parts) == 2 and relative.parts[0] == "model"
                and relative.suffix in {".bin", ".json", ".txt"}
            )
            if relative != PurePosixPath("sentencepiece.model") and not model_file:
                continue
            if relative.name in {".", ".."} or ":" in relative.name or "\\" in relative.name:
                raise ValueError(f"Unexpected archive member {entry.filename}")
            destination = model.joinpath(*relative.parts)
            if destination.is_file() and destination.stat().st_size == entry.file_size:
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as source, destination.open("wb") as target:
                shutil.copyfileobj(source, target)

    return model, archive_id, metadata.get("target_prefix", "")


def clean_gloss(value):
    text = normalize("NFC", value.replace("\u2581", " ").replace("♪", ""))
    text = re.sub(r"(?<=\w)\s*-\s*(?=\w)", "-", text)
    return " ".join(text.split()).strip(' &"')


def translate_terms(terms, archive_path, language):
    model, archive_id, prefix = prepare_model(archive_path, language)
    cache_file = CACHE / f"{language}-{archive_id}-glosses.json"
    translated = read_json(cache_file) if cache_file.is_file() else {}
    pending = sorted(terms.difference(translated), key=lambda term: (len(term), term))
    if not pending:
        return translated

    tokenizer = sentencepiece.SentencePieceProcessor(model_file=str(model / "sentencepiece.model"))
    translator = ctranslate2.Translator(
        str(model / "model"), device="cpu", compute_type="int8", intra_threads=4,
    )
    print(f"Translating {len(pending)} distinct phrases into {LANGUAGES[language]}.", flush=True)
    for start in range(0, len(pending), 512):
        batch = pending[start:start + 512]
        options = {"target_prefix": [[prefix] for _ in batch]} if prefix else {}
        answers = translator.translate_batch(
            tokenizer.encode(batch, out_type=str),
            beam_size=3,
            batch_type="tokens",
            max_batch_size=2048,
            max_decoding_length=160,
            replace_unknowns=True,
            **options,
        )
        for term, answer in zip(batch, answers, strict=True):
            tokens = answer.hypotheses[0]
            if prefix and tokens and tokens[0] == prefix:
                tokens = tokens[1:]
            result = " ".join(tokenizer.decode(tokens).split())
            if result:
                translated[term] = result
        print(f"  {start + len(batch)}/{len(pending)} phrases processed", flush=True)

    cache_file.write_text(json.dumps(translated, ensure_ascii=False), encoding="utf-8")
    missing = terms.difference(translated)
    if missing:
        raise ValueError(f"The model returned empty glosses for {sorted(missing)}")
    return translated


def generate(locale, archive):
    overrides = read_json(OVERRIDES_FILE)
    kanji_overrides = {kanji: terms[locale] for kanji, terms in overrides["kanji"].items() if locale in terms}
    reviewed_glosses = {source: terms[locale] for source, terms in overrides["glosses"].items() if locale in terms}
    english_overrides = overrides["englishVocabulary"]
    vocabulary_overrides = overrides["vocabulary"]
    kanji = {}
    terms = set()
    for level in LEVELS:
        source = ROOT / "Data" / "Kanji" / f"kanji_n{level}.json"
        for literal, entry in read_json(source).items():
            kanji[literal] = [
                meaning for meaning in entry["meanings"]
                if meaning != "(kokuji)" and any(character.isalnum() for character in meaning)
            ]
            if not kanji[literal] and literal not in kanji_overrides:
                raise ValueError(f"No English glosses for {literal}")

    for literal, meanings in kanji.items():
        if literal not in kanji_overrides:
            terms.update(meanings)

    vocabulary_files = list(read_english_vocabulary())
    for _, rows in vocabulary_files:
        for word, reading, english in rows:
            if locale not in vocabulary_overrides.get(word, {}).get(reading, {}):
                terms.add(english_overrides.get(word, {}).get(reading, english))
    if "" in terms:
        raise ValueError("At least one English gloss is empty.")

    gloss_overrides = {}
    for term in terms:
        gloss = reviewed_glosses.get(term, reviewed_glosses.get(term.casefold()))
        if gloss:
            gloss_overrides[term] = gloss

    translated = {
        source: clean_gloss(gloss)
        for source, gloss in translate_terms(terms.difference(gloss_overrides), archive, locale).items()
    }
    translated.update(gloss_overrides)
    missing = [term for term in terms if not any(character.isalnum() for character in translated[term])]
    if missing:
        raise ValueError(f"Missing readable glosses for {sorted(missing)}")
    target_language = LANGUAGES[locale]
    target_kanji = ROOT / "Data" / "Kanji" / target_language
    target_vocabulary = ROOT / "Data" / "Vocabulary" / target_language
    target_kanji.mkdir(parents=True, exist_ok=True)
    target_vocabulary.mkdir(parents=True, exist_ok=True)

    localized = {
        literal: kanji_overrides[literal] if literal in kanji_overrides
        else list(dict.fromkeys(translated[term] for term in meanings))
        for literal, meanings in kanji.items()
    }
    lines = [
        "  " + json.dumps(literal, ensure_ascii=False) + ": " + json.dumps(meanings, ensure_ascii=False)
        for literal, meanings in localized.items()
    ]
    (target_kanji / "meanings.json").write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf-8")

    for filename, rows in vocabulary_files:
        with (target_vocabulary / filename).open("w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file, lineterminator="\n")
            writer.writerow(["Kanji", "Reading", target_language])
            for word, reading, english in rows:
                meaning = vocabulary_overrides.get(word, {}).get(reading, {}).get(locale)
                if meaning is None:
                    meaning = translated[english_overrides.get(word, {}).get(reading, english)]
                writer.writerow([word, reading, meaning])

    print(
        f"Generated {target_language} meanings for {len(localized)} kanji and "
        f"{sum(len(rows) for _, rows in vocabulary_files)} vocabulary rows.",
        flush=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("language", choices=LANGUAGES)
    parser.add_argument("archive", type=Path, help="Path to the official Argos model package")
    args = parser.parse_args()
    generate(args.language, args.archive)
