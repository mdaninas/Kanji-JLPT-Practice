import { Component } from 'react';
import { clearKanjiAppStorage } from '../storageKeys.js';
import { formatText } from '../utils.js';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  handleReset = () => {
    clearKanjiAppStorage();
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const language = this.props.language || 'id';
    const t = (key) => formatText(language, key);
    return (
      <div className="errorBoundary" role="alert">
        <h1>{t('errorBoundaryTitle')}</h1>
        <p>{t('errorBoundaryMessage')}</p>
        <button type="button" className="primaryButton" onClick={this.handleReset}>
          {t('errorBoundaryReset')}
        </button>
      </div>
    );
  }
}
