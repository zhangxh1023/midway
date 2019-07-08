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

  get<T>(identifier: any, args?: any) {
    if (typeof identifier !== 'string') {
      identifier = this.getIdentifier(identifier);
    }
    const definition = this.applicationContext.registry.getDefinition(identifier);
    if (definition && definition.isRequestScope()) {
      // create object from applicationContext definition for requestScope
      return this.resolverFactory.create(definition, args);
    }

    if (this.parent) {
      return this.parent.get(identifier, args);
    }
  }

  async getAsync<T>(identifier: any, args?: any) {
    if (typeof identifier !== 'string') {
      identifier = this.getIdentifier(identifier);
    }

    const definition = this.applicationContext.registry.getDefinition(identifier);
    if (definition && definition.isRequestScope()) {
      if (definition.creator.constructor.name === 'FunctionWrapperCreator') {
        const valueManagedIns = new ManagedValue(this, VALUE_TYPE.OBJECT);
        definition.constructorArgs = [valueManagedIns];
      }
      // create object from applicationContext definition for requestScope
      return this.resolverFactory.createAsync(definition, args);
    }

    if (this.parent) {
      return this.parent.getAsync<T>(identifier, args);
    }
  }
}

export const createRequestContext = async (applicationContext, ctx) => {
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

            const definition = target.registry.getDefinition(identifier);
            if (definition && definition.isRequestScope()) {
              if (!self.objectCache.has(identifier)) {
                // create object from applicationContext definition for requestScope
                self.objectCache.set(definition.id, target.getAsync(identifier, args));
              }
              return self.objectCache.get(definition.id);
            }

            return target.getAsync(identifier, args);
          };
        case 'getAsync':
          return async (identifier, args) => {
            if (typeof identifier !== 'string') {
              identifier = target.getIdentifier(identifier);
            }

            const definition = target.registry.getDefinition(identifier);
            if (definition && definition.isRequestScope()) {
              if (!self.objectCache.has(identifier)) {
                // create object from applicationContext definition for requestScope
                self.objectCache.set(definition.id, target.getAsync(identifier, args));
              }
              return self.objectCache.get(definition.id);
            }

            return target.getAsync(identifier, args);
          };
        default:
          return target[property];
      }

    }
  });
  requestContainer.registerObject(REQUEST_CTX_KEY, ctx);
  requestContainer.registerObject('logger', ctx.logger);
  return requestContainer;
};
