import { app } from '../server/app.js';

export default {
  fetch(request) {
    return app.fetch(request);
  },
};
