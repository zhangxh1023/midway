'use strict';

const rc = Symbol('Context#RequestContext');

module.exports = {
  get requestContext() {
    if (!this[rc]) {
      const requestContext = this.app.applicationContext.get('requestContext');
      this[rc] = requestContext.createContext(this);
    }
    return this[rc];
  },
};
