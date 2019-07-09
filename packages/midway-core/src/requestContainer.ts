import { ManagedValue, REQUEST_CTX_KEY, VALUE_TYPE } from 'injection';
import { MidwayContainer } from './container';

export class MidwayRequestContainer extends MidwayContainer {

  applicationContext: MidwayContainer;
  ctx;

  constructor(applicationContext) {
    super();
    this.parent = applicationContext;
    this.applicationContext = applicationContext;
  }

  createContext(ctx) {
    return createRequestContext(this, ctx);
  }

}

export const createRequestContext = (applicationContext, ctx) => {
  const requestContainer = new Proxy(applicationContext, {
    get(target, property) {
      const self: any = this;
      if (!(this as any).objectCache) {
        (this as any).objectCache = new Map();
      }
      switch (property) {
        case 'registry':
          return {
            hasObject(key) {
              return self.objectCache.has(key);
            },
            getObject(key) {
              return self.objectCache.get(key);
            },
            registerObject(key, value) {
              return self.objectCache.set(key, value);
            }
          };
        case 'registerObject':
          return (key, value) => {
            return self.objectCache.set(key, value);
          };
        case 'get':
          return (identifier, args) => {
            if (typeof identifier !== 'string') {
              identifier = target.getIdentifier(identifier);
            }

            if (self.objectCache.has(identifier)) {
              return self.objectCache.get(identifier);
            }

            const definition = target.parent.registry.getDefinition(identifier);
            if (definition && definition.isRequestScope()) {
              if (definition.creator.constructor.name === 'FunctionWrapperCreator') {
                const valueManagedIns = new ManagedValue(this, VALUE_TYPE.OBJECT);
                definition.constructorArgs = [valueManagedIns];
              }
              if (!self.objectCache.has(identifier)) {
                // create object from applicationContext definition for requestScope
                self.objectCache.set(definition.id, target.resolverFactory.create(definition, args));
              }
              return self.objectCache.get(definition.id);
            }

            if (target.parent) {
              return target.parent.get(identifier, args);
            }
          };
        case 'getAsync':
          return async (identifier, args) => {
            if (typeof identifier !== 'string') {
              identifier = target.getIdentifier(identifier);
            }

            // return logger, ctx or other target
            if (self.objectCache.has(identifier)) {
              return self.objectCache.get(identifier);
            }

            // current registry always empty, must get info from parent
            const definition = target.parent.registry.getDefinition(identifier);
            if (definition && definition.isRequestScope()) {
              if (definition.creator.constructor.name === 'FunctionWrapperCreator') {
                const valueManagedIns = new ManagedValue(this, VALUE_TYPE.OBJECT);
                definition.constructorArgs = [valueManagedIns];
              }
              if (!self.objectCache.has(identifier)) {
                // create object from applicationContext definition for requestScope
                self.objectCache.set(definition.id, await target.getAsync.call(self, definition.id, args));
              }
              return self.objectCache.get(definition.id);
            }

            if (target.parent) {
              return target.parent.getAsync(identifier, args);
            }
          };
        default:
          return target[property].bind(this);
      }

    }
  });
  requestContainer.registerObject(REQUEST_CTX_KEY, ctx);
  requestContainer.registerObject('logger', ctx.logger);
  return requestContainer;
};
