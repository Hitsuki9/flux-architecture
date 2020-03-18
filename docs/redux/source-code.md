# 源码解析

## 目录

```bash
src
│── applyMiddleware.js
│── bindActionCreators.js
│── combineReducers.js
│── compose.js
│── createStore.js
│── index.js
└── utils
    │── actionTypes.js
    │── isPlainObject.js
    └── warning.js
```

## createStore

- `reducer: Function` 一个接收并处理当前状态树和 action，返回下一个状态树的函数。

- `[preloadedState: any]` 初始状态。如果使用 `combineReducers` 来生成一个 root reducer，则该参数必须是一个与 `combineReducers` 得到的结果结构相同的对象。

- `[enhancer: Function]` store 增强器。可以指定第三方功能来增强 store，例如中间件，time travel，持久化等。Redux 附带的唯一的 store 增强器是 `applyMiddleware()`。

- `returns: Store` Redux store，可获取状态，分发 actions 和订阅 changes。

```js
function createStore(reducer, preloadedState, enhancer) {
  // ...
}
```

多个 enhancer 需要使用 `compose` 聚合成一个函数传入。

```js
if (
  (typeof preloadedState === 'function' && typeof enhancer === 'function') ||
  (typeof enhancer === 'function' && typeof arguments[3] === 'function')
) {
  throw new Error(
    'It looks like you are passing several store enhancers to ' +
      'createStore(). This is not supported. Instead, compose them ' +
      'together to a single function.'
  );
}
```

当传给 preloadedState 函数，enhancer `undefined` 时，实际是将函数赋值给了 enhancer，而 preloadedState 是 `undefined`。

```js
if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
  enhancer = preloadedState;
  preloadedState = undefined;
}
```

当传入了合法的 enhancer 时，直接返回增强后 store，可见 enhancer 的参数与返回值都是 `createStore`。

```js
if (typeof enhancer !== 'undefined') {
  if (typeof enhancer !== 'function') {
    throw new Error('Expected the enhancer to be a function.');
  }
  return enhancer(createStore)(reducer, preloadedState);
}
```

初始化 store 内部状态。

```js
let currentReducer = reducer; // 当前 reducer
let currentState = preloadedState; // 当前状态
let currentListeners = []; // TODO
let nextListeners = currentListeners; // TODO
let isDispatching = false; // 是否正在分发
```
