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

`Store` 类构造函数。`options` 参数可包含 `state`、`getters`、`mutations` 和 `actions`。

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
this._committing = false; // TODO
this._actions = Object.create(null); // TODO
this._actionSubscribers = []; // TODO
this._mutations = Object.create(null); // TODO
this._wrappedGetters = Object.create(null); // TODO
// 处理 options 参数，生成模块收集实例，它的 root 属性即为根模块实例
this._modules = new ModuleCollection(options);
// 命名空间与模块映射 map
this._modulesNamespaceMap = Object.create(null);
this._subscribers = []; // TODO
this._watcherVM = new Vue(); // TODO
this._makeLocalGettersCache = Object.create(null); // TODO
```

绑定 `dispatch` 和 `commit` 的上下文。

```js
const store = this;
const { dispatch, commit } = this;
// 绑定后的 dispatch 与 commit 由原型方法变成了实例方法
this.dispatch = function boundDispatch(type, payload) {
  return dispatch.call(store, type, payload);
};
this.commit = function boundCommit(type, payload, options) {
  return commit.call(store, type, payload, options);
};
```

```js
// TODO
this.strict = strict;
const state = this._modules.root.state;
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

```js
function installModule(store, rootState, path, module, hot) {
  const isRoot = !path.length; // 是否是根模块
  // 获得模块的命名空间
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
    // TODO
    const parentState = getNestedState(rootState, path.slice(0, -1));
    const moduleName = path[path.length - 1];
    store._withCommit(() => {
      if (process.env.NODE_ENV !== 'production') {
        if (moduleName in parentState) {
          console.warn(
            `[vuex] state field "${moduleName}" was overridden by a module with the same name at "${path.join(
              '.'
            )}"`
          );
        }
      }
      Vue.set(parentState, moduleName, module.state);
    });
  }
  const local = (module.context = makeLocalContext(store, namespace, path));
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
    installModule(store, rootState, path.concat(key), child, hot);
  });
}
```

### getNestedState

```js
function getNestedState(state, path) {
  return path.reduce((state, key) => state[key], state);
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
  forEachChild(fn) {
    forEachValue(this._children, fn);
  }
  forEachGetter(fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn);
    }
  }
  forEachAction(fn) {
    if (this._rawModule.actions) {
      forEachValue(this._rawModule.actions, fn);
    }
  }
  forEachMutation(fn) {
    if (this._rawModule.mutations) {
      forEachValue(this._rawModule.mutations, fn);
    }
  }
}
```
