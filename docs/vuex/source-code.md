# 源码解析

## 目录

```bash
src
│── helpers.js
│── index.esm.js
│── index.js
│── mixin.js
│── module
│   │── module-collection.js
│   └── module.js
│── plugins
│   │── devtool.js
│   └── logger.js
│── store.js
└── util.js
```

## store

`Store` 类构造函数。`options` 参数可包含 `state`、`getters`、`mutations`、`actions`、`plugins`、`strict`、`devtools` 和 `modules`。

`modules` 中又可包含 `state`、`getters`、`mutations`、`actions`、`namespaced` 和 `modules`。

```js
let Vue; // 调用 install 时绑定

class Store {
  constructor(options = {}) {
    // ...
  }
}
```

在某些情况下防止自动安装。

```js
// 未 install 过，且在浏览器环境下，且具有全局 Vue 属性
// 满足以上所有条件才会自动安装
if (!Vue && typeof window !== 'undefined' && window.Vue) {
  install(window.Vue);
}
```

非生产环境下的检测。

```js
if (process.env.NODE_ENV !== 'production') {
  // 创建 store 实例前必须先调用 Vue.use(Vuex)
  assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`);
  // vuex 需要 Promise 或 Promise 的 Polyfill
  assert(
    typeof Promise !== 'undefined',
    `vuex requires a Promise polyfill in this browser.`
  );
  // Store 必须使用 new 操作符调用
  assert(this instanceof Store, `store must be called with the new operator.`);
}

// util.js
// 断言
function assert(condition, msg) {
  if (!condition) throw new Error(`[vuex] ${msg}`);
}
```

初始化 store 内部的状态。

```js
const {
  plugins = [], // 插件
  strict = false // 是否是严格模式
} = options;
this._committing = false; // 是否正在提交
this._actions = Object.create(null); // 全局 actions
this._actionSubscribers = []; // TODO
// 所有模块的 mutations 集合
// 每个 mutation 是一个数组，为了多个模块下的同名 mutations 能响应同一个 commit
this._mutations = Object.create(null);
// 所有模块的 getters 集合
this._wrappedGetters = Object.create(null);
// 处理 options 参数，生成模块收集实例，它的 root 属性即为根模块实例
this._modules = new ModuleCollection(options);
// 命名空间与模块映射 map
this._modulesNamespaceMap = Object.create(null);
this._subscribers = []; // TODO
this._watcherVM = new Vue(); // 用于观察的 vm 实例
this._makeLocalGettersCache = Object.create(null); // TODO
```

绑定 `dispatch` 和 `commit` 的上下文。

```js
const store = this;
const { dispatch, commit } = this;
// 绑定后的 dispatch 与 commit 由原型方法变成了实例方法
// 全局 dispatch 不需要第三个参数
// TODO
this.dispatch = function boundDispatch(type, payload) {
  return dispatch.call(store, type, payload);
};
this.commit = function boundCommit(type, payload, options) {
  return commit.call(store, type, payload, options);
};
```

### dispatch

```js
dispatch (_type, _payload) {
  // 检查使用对象风格调用的 dispatch
  const {
    type,
    payload
  } = unifyObjectStyle(_type, _payload)
  // 根据参数构建出 action 并获取已注册的对应的 action
  // TODO
  const action = { type, payload }
  const entry = this._actions[type]
  // 没有找到对应的 action
  if (!entry) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[vuex] unknown action type: ${type}`)
    }
    return
  }
  try {
    // TODO
    this._actionSubscribers
      .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
      .filter(sub => sub.before)
      .forEach(sub => sub.before(action, this.state))
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[vuex] error in before action subscribers: `)
      console.error(e)
    }
  }
  const result = entry.length > 1
    ? Promise.all(entry.map(handler => handler(payload)))
    : entry[0](payload)
  return result.then(res => {
    try {
      this._actionSubscribers
        .filter(sub => sub.after)
        .forEach(sub => sub.after(action, this.state))
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[vuex] error in after action subscribers: `)
        console.error(e)
      }
    }
    return res
  })
}
```

```js
this.strict = strict;
const state = this._modules.root.state;
// 初始化根模块并递归注册子模块
// 收集所有模块的 getters 到 this._wrappedGetters
installModule(this, state, [], this._modules.root);
resetStoreVM(this, state);
// 调用插件，参数为 store 实例
plugins.forEach((plugin) => plugin(this));
// 是否订阅到 devtools 插件
const useDevtools =
  options.devtools !== undefined ? options.devtools : Vue.config.devtools;
if (useDevtools) {
  devtoolPlugin(this);
}
```

### installModule

递归注册模块及其子模块。

```js
function installModule(store, rootState, path, module, hot) {
  const isRoot = !path.length; // 是否是根模块
  // 获得模块路径对应模块的命名空间
  const namespace = store._modules.getNamespace(path);
  // 如果模块启用了命名空间，则注册到命名空间 map
  if (module.namespaced) {
    // 非生产环境下注册重复的命名空间时发出警告
    if (
      store._modulesNamespaceMap[namespace] &&
      process.env.NODE_ENV !== 'production'
    ) {
      console.error(
        `[vuex] duplicate namespace ${namespace} for the namespaced module ${path.join(
          '/'
        )}`
      );
    }
    store._modulesNamespaceMap[namespace] = module;
  }
  // 不是根模块
  if (!isRoot && !hot) {
    // 获取父 state
    const parentState = getNestedState(rootState, path.slice(0, -1));
    // 获取模块名
    const moduleName = path[path.length - 1];
    store._withCommit(() => {
      // 非生产环境下，如果父 state 中有与该子模块名同名的属性，则发出警告
      if (process.env.NODE_ENV !== 'production') {
        if (moduleName in parentState) {
          console.warn(
            `[vuex] state field "${moduleName}" was overridden by a module with the same name at "${path.join(
              '.'
            )}"`
          );
        }
      }
      // 为父 state 添加属性并响应化，key 为子模块名，value 为子模块的 state
      Vue.set(parentState, moduleName, module.state);
    });
  }
  // 创建模块对应的上下文
  const local = (module.context = makeLocalContext(store, namespace, path));
  // 注册 mutations
  module.forEachMutation((mutation, key) => {
    const namespacedType = namespace + key;
    registerMutation(store, namespacedType, mutation, local);
  });
  module.forEachAction((action, key) => {
    const type = action.root ? key : namespace + key;
    const handler = action.handler || action;
    registerAction(store, type, handler, local);
  });
  module.forEachGetter((getter, key) => {
    const namespacedType = namespace + key;
    registerGetter(store, namespacedType, getter, local);
  });
  module.forEachChild((child, key) => {
    // 递归注册模块
    installModule(store, rootState, path.concat(key), child, hot);
  });
}
```

### getNestedState

获取嵌套的 state。

```js
function getNestedState(state, path) {
  return path.reduce((state, key) => state[key], state);
}
```

### \_withCommit

防止在执行指定函数期间进行提交。

```js
_withCommit (fn) {
  const committing = this._committing
  this._committing = true
  fn()
  this._committing = committing
}
```

### makeLocalContext

创建模块对应的上下文。

```js
function makeLocalContext(store, namespace, path) {
  // 命名空间是否为 ''
  // 是 '' 说明是根模块，否则是子模块
  const noNamespace = namespace === '';
  const local = {
    dispatch: noNamespace
      ? // 是根模块，则直接使用 store 的 dispatch
        store.dispatch
      : // 有子模块，则创建一个新的 dispatch
        (_type, _payload, _options) => {
          // 统一两种形式的入参
          // TODO
          const args = unifyObjectStyle(_type, _payload, _options);
          const { payload, options } = args;
          let { type } = args;
          // 没有 options 参数或者 options.root 不为 true
          // 则说明进行局部 dispatch，更改 type 为命名空间下的 type
          if (!options || !options.root) {
            type = namespace + type;
            // 非生产环境下若 TODO
            if (
              process.env.NODE_ENV !== 'production' &&
              !store._actions[type]
            ) {
              console.error(
                `[vuex] unknown local action type: ${args.type}, global type: ${type}`
              );
              return;
            }
          }
          return store.dispatch(type, payload);
        },
    // commit 与 dispatch 同理
    commit: noNamespace
      ? store.commit
      : (_type, _payload, _options) => {
          const args = unifyObjectStyle(_type, _payload, _options);
          const { payload, options } = args;
          let { type } = args;
          if (!options || !options.root) {
            type = namespace + type;
            if (
              process.env.NODE_ENV !== 'production' &&
              !store._mutations[type]
            ) {
              console.error(
                `[vuex] unknown local mutation type: ${args.type}, global type: ${type}`
              );
              return;
            }
          }
          store.commit(type, payload, options);
        }
  };
  // 为上下文定义 getters 和 state
  // 必须延迟获取 getters 和 state 对象，因为它们会因为 vm 的更新而更改
  Object.defineProperties(local, {
    getters: {
      get: noNamespace
        ? // 无命名空间
          () => store.getters
        : // 有命名空间
          () => makeLocalGetters(store, namespace)
    },
    state: {
      get: () => getNestedState(store.state, path)
    }
  });
  return local;
}
```

### unifyObjectStyle

统一 `dispatch` 和 `commit` 的两种不同形式的入参。

- `dispatch(type: string, payload?: any, options?: Object)`

- `dispatch(action: Object, options?: Object)`

- `commit(type: string, payload?: any, options?: Object)`

- `commit(mutation: Object, options?: Object)`

```js
function unifyObjectStyle(type, payload, options) {
  // 如果 type 是对象，且有 type 属性，则为第二种传参形式
  // 统一成第一种传参形式
  if (isObject(type) && type.type) {
    options = payload;
    payload = type;
    type = type.type;
  }
  // 非生产环境下真实的 type 不为字符串时抛出错误
  if (process.env.NODE_ENV !== 'production') {
    assert(
      typeof type === 'string',
      `expects string as the type, but found ${typeof type}.`
    );
  }
  return { type, payload, options };
}

// util.js
function isObject(obj) {
  return obj !== null && typeof obj === 'object';
}
```

### registerMutation

注册模块的 mutations 到 store。

```js
/**
 * @param {Store} store store 实例
 * @param {string} type
 * @param {Function} handler mutation
 * @param {Object} local 模块上下文
 */
function registerMutation(store, type, handler, local) {
  const entry = store._mutations[type] || (store._mutations[type] = []);
  entry.push(function wrappedMutationHandler(payload) {
    handler.call(store, local.state, payload);
  });
}
```

### install

供 `Vue.use()` 使用。

```js
function install(_Vue) {
  // 对于同一个 Vue 构造函数，Vuex 只能被安装一次
  if (Vue && _Vue === Vue) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      );
    }
    return;
  }
  Vue = _Vue; // 绑定传入的 Vue 构造函数
  applyMixin(Vue); // TODO
}
```

## module

### ModuleCollection

模块收集类，处理调用 `new Vuex.Store()` 时传入的参数。

```js
class ModuleCollection {
  constructor(rawRootModule) {
    // 注册根模块
    this.register([], rawRootModule, false);
  }
  // 获取模块路径对应的模块
  get(path) {
    return path.reduce((module, key) => {
      return module.getChild(key);
    }, this.root);
  }
  // 根据模块路径生成命名空间
  getNamespace(path) {
    let module = this.root;
    return path.reduce((namespace, key) => {
      module = module.getChild(key);
      return namespace + (module.namespaced ? key + '/' : '');
    }, '');
  }
  update(rawRootModule) {
    update([], this.root, rawRootModule);
  }
  /**
   * @param {Array<string>} path 模块路径
   * @param {Object} rawModule 模块
   * @param {boolean} runtime
   */
  register(path, rawModule, runtime = true) {
    // 非生产环境下检测模块的合法性
    if (process.env.NODE_ENV !== 'production') {
      assertRawModule(path, rawModule);
    }
    // 创建一个 module 实例
    const newModule = new Module(rawModule, runtime);
    // 根模块
    if (path.length === 0) {
      this.root = newModule;
    }
    // 非根模块
    else {
      // 获取父模块，并将当前模块添加到父模块的子模块中
      const parent = this.get(path.slice(0, -1));
      parent.addChild(path[path.length - 1], newModule);
    }
    // 原始模块对象中有 modules 字段，即有子模块，
    // 则递归遍历并注册子模块
    if (rawModule.modules) {
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule, runtime);
      });
    }
  }
  unregister(path) {
    const parent = this.get(path.slice(0, -1));
    const key = path[path.length - 1];
    if (!parent.getChild(key).runtime) return;
    parent.removeChild(key);
  }
}
```

### assertRawModule

检测模块内 `getters`，`mutations`，`actions` 值的合法性。

```js
const functionAssert = {
  assert: (value) => typeof value === 'function',
  expected: 'function'
};
const objectAssert = {
  assert: (value) =>
    typeof value === 'function' ||
    (typeof value === 'object' && typeof value.handler === 'function'),
  expected: 'function or object with "handler" function'
};
const assertTypes = {
  getters: functionAssert, // getters 内的项应该是函数
  mutations: functionAssert, // mutations 内的项应该是函数
  actions: objectAssert // actions 内的项应该是函数或具有 handler 方法的对象
};

function assertRawModule(path, rawModule) {
  Object.keys(assertTypes).forEach((key) => {
    if (!rawModule[key]) return;
    // 模块中存在 getters，mutations 或 actions 对象时
    // 遍历它们并检测各项的 value 是否合法
    const assertOptions = assertTypes[key];
    forEachValue(rawModule[key], (value, type) => {
      assert(
        assertOptions.assert(value),
        makeAssertionMessage(path, key, type, value, assertOptions.expected)
      );
    });
  });
}

// util.js
// 用于对象的 forEach
function forEachValue(obj, fn) {
  Object.keys(obj).forEach((key) => fn(obj[key], key));
}
```

### makeAssertionMessage

生成断言的提示信息。

```js
/**
 * @param {Array<string>} path 模块路径
 * @param {'getters'|'mutations'|'actions'} key
 * @param {string} type getters/mutations/actions 中的键值
 * @param {Object|Function} value getters/mutations/actions 中的值
 * @param {string} expected 期望的类型描述
 * @returns {string} 完整的断言提示信息
 */
function makeAssertionMessage(path, key, type, value, expected) {
  let buf = `${key} should be ${expected} but "${key}.${type}"`;
  // 非根模块
  if (path.length > 0) {
    buf += ` in module "${path.join('.')}"`;
  }
  buf += ` is ${JSON.stringify(value)}.`;
  return buf;
}
```

### Module

模块类，管理单个模块。

```js
class Module {
  constructor(rawModule, runtime) {
    this.runtime = runtime;
    this._children = Object.create(null); // 存储子模块
    this._rawModule = rawModule; // 存储原始模块对象
    // 存储原始模块对象中的 state
    const rawState = rawModule.state;
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {};
  }
  // 是否启用命名空间
  get namespaced() {
    return !!this._rawModule.namespaced;
  }
  // 添加子模块
  addChild(key, module) {
    this._children[key] = module;
  }
  removeChild(key) {
    delete this._children[key];
  }
  // 获取对应的子模块
  getChild(key) {
    return this._children[key];
  }
  update(rawModule) {
    this._rawModule.namespaced = rawModule.namespaced;
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions;
    }
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations;
    }
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters;
    }
  }
  // 遍历模块的子模块
  forEachChild(fn) {
    forEachValue(this._children, fn);
  }
  // 遍历模块的 getters
  forEachGetter(fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn);
    }
  }
  // 遍历模块的 actions
  forEachAction(fn) {
    if (this._rawModule.actions) {
      forEachValue(this._rawModule.actions, fn);
    }
  }
  // 遍历模块的 mutations
  forEachMutation(fn) {
    if (this._rawModule.mutations) {
      forEachValue(this._rawModule.mutations, fn);
    }
  }
}
```
