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
let currentListeners = []; // 当前订阅列表的快照
let nextListeners = currentListeners; // 订阅列表
let isDispatching = false; // 是否正在分发
```

分发一个 `INIT` type 的 action，让每一个的 reducer 返回初始状态。

`INIT` 是 Redux 保留的私有 action type，并且对于任何未知的 actions，都必须返回当前状态，如果当前状态未定义，则必须返回初始状态。

```js
dispatch({ type: ActionTypes.INIT });

// utils/actionTypes.js
const randomString = () =>
  Math.random()
    .toString(36)
    .substring(7)
    .split('')
    .join('.');

const ActionTypes = {
  INIT: `@@redux/INIT${randomString()}`,
  REPLACE: `@@redux/REPLACE${randomString()}`
  // ...
};
```

### dispatch

`dispatch` 是触发状态更改的唯一方法。基本实现仅支持纯对象的 actions，如果要分发 `Promise` 或其他东西，则需要使用相应的中间件。

```js
function dispatch(action) {
  // action 必须是一个纯对象
  if (!isPlainObject(action)) {
    throw new Error(
      'Actions must be plain objects. ' +
        'Use custom middleware for async actions.'
    );
  }
  // action 必须有有效的 type 属性
  if (typeof action.type === 'undefined') {
    throw new Error(
      'Actions may not have an undefined "type" property. ' +
        'Have you misspelled a constant?'
    );
  }
  if (isDispatching) {
    throw new Error('Reducers may not dispatch actions.');
  }
  try {
    isDispatching = true;
    // 将当前状态树和 action 作为参数调用 reducer，返回一个新的状态树
    currentState = currentReducer(currentState, action);
  } finally {
    isDispatching = false;
  }
  // 状态变化后先生成当前订阅列表的快照，然后通知该快照中的所有监听器
  const listeners = (currentListeners = nextListeners);
  for (let i = 0; i < listeners.length; i++) {
    const listener = listeners[i];
    listener();
  }
  return action; // 将入参 action 返回
}

// utils/isPlainObject.js
function isPlainObject(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
  let proto = obj;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(obj) === proto;
}
```

### getState

读取 store 管理的 state，但是不能在 reducer 执行期间读取。

```js
function getState() {
  if (isDispatching) {
    throw new Error(
      'You may not call store.getState() while the reducer is executing. ' +
        'The reducer has already received the state as an argument. ' +
        'Pass it down from the top reducer instead of reading it from the store.'
    );
  }
  return currentState;
}
```

### replaceReducer

替换 store 当前正在使用的 reducer。`REPLACE` type 的 action 和 `INIT` type 的 action 具有类似的效果。所有同时存在于新旧 `rootReducer` 中的 reducers 都将接收到旧的状态树，这样可以有效地利用来自旧状态树的相关数据来填充新的状态树。

```js
function replaceReducer(nextReducer) {
  if (typeof nextReducer !== 'function') {
    throw new Error('Expected the nextReducer to be a function.');
  }
  currentReducer = nextReducer;
  dispatch({ type: ActionTypes.REPLACE });
}
```

### subscribe

添加 change 监听器。每当分发完 action 时都会调用它，此时状态树中的某些部分可能已经更改，可以在回调函数中调用 `getState()` 来读取当前状态树。

可以在监听器中调用 `dispatch()`，但必须注意以下几点：

1. 如果在监听器中订阅或者取消订阅，不会对当前正在进行的 `dispatch()` 产生影响，但是对于下一个将被调用的 `dispatch()`，都将使用最新的订阅列表。

2. 监听器不应该期望能看到每一次的状态变更，因为状态可能已由嵌套的 `dispatch()` 更新多次了。

```js
function subscribe(listener) {
  if (typeof listener !== 'function') {
    throw new Error('Expected the listener to be a function.');
  }
  if (isDispatching) {
    throw new Error(
      'You may not call store.subscribe() while the reducer is executing. ' +
        'If you would like to be notified after the store has been updated, subscribe from a ' +
        'component and invoke store.getState() in the callback to access the latest state. ' +
        'See https://redux.js.org/api-reference/store#subscribelistener for more details.'
    );
  }
  let isSubscribed = true;
  // 生成新的订阅列表，然后在新的订阅列表中添加监听器
  ensureCanMutateNextListeners();
  nextListeners.push(listener);
  // 返回取消订阅的函数
  return function unsubscribe() {
    if (!isSubscribed) {
      return;
    }
    if (isDispatching) {
      throw new Error(
        'You may not unsubscribe from a store listener while the reducer is executing. ' +
          'See https://redux.js.org/api-reference/store#subscribelistener for more details.'
      );
    }
    isSubscribed = false;
    // 同上
    ensureCanMutateNextListeners();
    const index = nextListeners.indexOf(listener);
    nextListeners.splice(index, 1);
    currentListeners = null;
  };
}

function ensureCanMutateNextListeners() {
  if (nextListeners === currentListeners) {
    nextListeners = currentListeners.slice();
  }
}
```

### observable

```js
function observable() {
  const outerSubscribe = subscribe;
  return {
    /**
     * The minimal observable subscription method.
     * @param {Object} observer Any object that can be used as an observer.
     * The observer object should have a `next` method.
     * @returns {subscription} An object with an `unsubscribe` method that can
     * be used to unsubscribe the observable from the store, and prevent further
     * emission of values from the observable.
     */
    subscribe(observer) {
      if (typeof observer !== 'object' || observer === null) {
        throw new TypeError('Expected the observer to be an object.');
      }
      function observeState() {
        if (observer.next) {
          observer.next(getState());
        }
      }
      observeState();
      const unsubscribe = outerSubscribe(observeState);
      return { unsubscribe };
    },
    [$$observable]() {
      return this;
    }
  };
}
```

最后，返回 store。

```js
return {
  dispatch,
  subscribe,
  getState,
  replaceReducer,
  [$$observable]: observable
};
```
