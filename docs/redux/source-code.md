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
  REPLACE: `@@redux/REPLACE${randomString()}`,
  PROBE_UNKNOWN_ACTION: () => `@@redux/PROBE_UNKNOWN_ACTION${randomString()}`
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

一个最简的 observable 订阅方法。

```js
function observable() {
  const outerSubscribe = subscribe;
  return {
    // observer 对象应该要有 next 方法
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
      // 返回取消订阅的方法
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
import $$observable from 'symbol-observable';

return {
  dispatch,
  subscribe,
  getState,
  replaceReducer,
  [$$observable]: observable
};
```

## combineReducers

- `reducers: Object` 一个包含需要合并成一个 reducer 的不同 reducers 的对象。一个简便的方法是通过 ES6 的 `import * as reducers` 来获得。

- `returns: Function` 合并的 reducer 函数，该函数调用参数内的每个 reducer，并构建与参数对象具有**相同形状**的状态树。

```js
function combineReducers(reducers) {
  // ...
}
```

获取 reducers 的键值列表，并构建一个形状相同的对象。

```js
const reducerKeys = Object.keys(reducers);
const finalReducers = {};
for (let i = 0; i < reducerKeys.length; i++) {
  const key = reducerKeys[i];
  // 过滤掉非 function 的 reducers
  if (process.env.NODE_ENV !== 'production') {
    if (typeof reducers[key] === 'undefined') {
      warning(`No reducer provided for key "${key}"`);
    }
  }
  if (typeof reducers[key] === 'function') {
    finalReducers[key] = reducers[key];
  }
}
const finalReducerKeys = Object.keys(finalReducers);
// 一个缓存，用于在非生产环境下检测 state 的形状使用，可防止重复发出警告
let unexpectedKeyCache;
if (process.env.NODE_ENV !== 'production') {
  unexpectedKeyCache = {};
}
let shapeAssertionError;
try {
  assertReducerShape(finalReducers);
} catch (e) {
  shapeAssertionError = e;
}
```

### assertReducerShape

检测 reducers 是否都符和要求

```js
function assertReducerShape(reducers) {
  Object.keys(reducers).forEach((key) => {
    // 获取每一个 reducer 对应的初始 state
    const reducer = reducers[key];
    // 这里无法使用 createStore 的 preloadedState 参数
    // 因此 reducer 的 state 参数必须要有默认值
    const initialState = reducer(undefined, { type: ActionTypes.INIT });
    // reducer 必须返回 null 或初始状态，不能是 undefined
    if (typeof initialState === 'undefined') {
      throw new Error(
        `Reducer "${key}" returned undefined during initialization. ` +
          `If the state passed to the reducer is undefined, you must ` +
          `explicitly return the initial state. The initial state may ` +
          `not be undefined. If you don't want to set a value for this reducer, ` +
          `you can use null instead of undefined.`
      );
    }
    // 检测 reducer 对未知 action 的处理能力
    if (
      typeof reducer(undefined, {
        type: ActionTypes.PROBE_UNKNOWN_ACTION()
      }) === 'undefined'
    ) {
      throw new Error(
        `Reducer "${key}" returned undefined when probed with a random type. ` +
          `Don't try to handle ${ActionTypes.INIT} or other actions in "redux/*" ` +
          `namespace. They are considered private. Instead, you must return the ` +
          `current state for any unknown actions, unless it is undefined, ` +
          `in which case you must return the initial state, regardless of the ` +
          `action type. The initial state may not be undefined, but can be null.`
      );
    }
  });
}
```

返回合并后的 reducer。该 reducer 只能使用 `createStore` 的 `preloadedState` 参数或通过子 reducers 来返回初始状态。

```js
return function combination(state = {}, action) {
  // 先前检测到有不符合要求的 reducer，在调用最终合并的 reducer 时才会抛出错误
  if (shapeAssertionError) {
    throw shapeAssertionError;
  }
  if (process.env.NODE_ENV !== 'production') {
    const warningMessage = getUnexpectedStateShapeWarningMessage(
      state,
      finalReducers,
      action,
      unexpectedKeyCache
    );
    if (warningMessage) {
      warning(warningMessage);
    }
  }
  let hasChanged = false; // 状态是否改变的标记
  const nextState = {};
  for (let i = 0; i < finalReducerKeys.length; i++) {
    const key = finalReducerKeys[i];
    const reducer = finalReducers[key];
    // 取子 reducer 对应的前一个状态来调用该 reducer
    const previousStateForKey = state[key];
    const nextStateForKey = reducer(previousStateForKey, action);
    // 子 reducer 不能返回 undefined，否则会抛出错误
    if (typeof nextStateForKey === 'undefined') {
      const errorMessage = getUndefinedStateErrorMessage(key, action);
      throw new Error(errorMessage);
    }
    nextState[key] = nextStateForKey;
    hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
  }
  // 子 reducers 对应的子状态只要有一个发生变化，整个状态树都将更新
  // 或者当旧状态中有多余的键值时也将更新，新的状态中将不含那些键
  hasChanged =
    hasChanged || finalReducerKeys.length !== Object.keys(state).length;
  return hasChanged ? nextState : state;
};
```

### getUnexpectedStateShapeWarningMessage

检测 state 的形状，并在检测到预期外的形状时发出警告（非生产环境）。

> state 的键值可 <= reducers 对象的键值。

```js
function getUnexpectedStateShapeWarningMessage(
  inputState,
  reducers,
  action,
  unexpectedKeyCache
) {
  const reducerKeys = Object.keys(reducers);
  const argumentName =
    action && action.type === ActionTypes.INIT
      ? 'preloadedState argument passed to createStore'
      : 'previous state received by the reducer';
  if (reducerKeys.length === 0) {
    return (
      'Store does not have a valid reducer. Make sure the argument passed ' +
      'to combineReducers is an object whose values are reducers.'
    );
  }
  // state 必须是一个纯对象
  if (!isPlainObject(inputState)) {
    return (
      `The ${argumentName} has unexpected type of "` +
      {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
      `". Expected argument to be an object with the following ` +
      `keys: "${reducerKeys.join('", "')}"`
    );
  }
  // 过滤出 state 中存在但是 reducers 对象和缓存中不存在的键值
  const unexpectedKeys = Object.keys(inputState).filter(
    (key) => !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key]
  );
  // 更新缓存
  unexpectedKeys.forEach((key) => {
    unexpectedKeyCache[key] = true;
  });
  // 如果是由调用 replaceReducer 所发出的 action，则不发出警告
  if (action && action.type === ActionTypes.REPLACE) return;
  if (unexpectedKeys.length > 0) {
    return (
      `Unexpected ${unexpectedKeys.length > 1 ? 'keys' : 'key'} ` +
      `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
      `Expected to find one of the known reducer keys instead: ` +
      `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
    );
  }
}
```

### getUndefinedStateErrorMessage

一个当子 reducer 返回 `undefined` 时生成错误描述信息的函数。

```js
function getUndefinedStateErrorMessage(key, action) {
  const actionType = action && action.type;
  const actionDescription =
    (actionType && `action "${String(actionType)}"`) || 'an action';
  return (
    `Given ${actionDescription}, reducer "${key}" returned undefined. ` +
    `To ignore an action, you must explicitly return the previous state. ` +
    `If you want this reducer to hold no value, you can return null instead of undefined.`
  );
}
```

## compose

`funcs: ...Function` 需要组合的函数。

`returns: Function` 通过从右至左组合参数函数而获得的函数。例如，`compose(f, g, h)` 的结果与 `(...args) => f(g(h(...args)))` 相同。

`compose` 的作用很简单，就是返回一个将参数中的函数按倒序调用，并且前一个函数的返回值将作为后一个函数的参数的函数。

```js
function compose(...funcs) {
  if (funcs.length === 0) {
    return (arg) => arg;
  }
  if (funcs.length === 1) {
    return funcs[0];
  }
  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}
```

## applyMiddleware

`middlewares: ...Function` 需要应用的中间件链。

`returns: Function` 一个应用了中间件的 store 增强器函数。

因为中间件可能是异步的，所以它应该是组合链中的第一个 store 增强器。

> 每个中间件都会被赋予 `dispatch` 和 `getState` 函数作为参数。

```js
function applyMiddleware(...middlewares) {
  // ...
}
```

直接返回一个接收 `createStore` 作为参数，并且返回一个增强的 `createStore` 的函数。

```js
return (createStore) => (...args) => {
  const store = createStore(...args);
  // 不能在构建中间件的过程中进行分发，因为其它中间件可能不会应用在这次分发中
  let dispatch = () => {
    throw new Error(
      'Dispatching while constructing your middleware is not allowed. ' +
        'Other middleware would not be applied to this dispatch.'
    );
  };
  const middlewareAPI = {
    getState: store.getState,
    // 注意这里没有直接引用 dispatch 是为了之后 dispatch 被覆写以后可以调用最新的 dispatch
    dispatch: (...args) => dispatch(...args)
  };
  // 中间件形如
  // ({ dispatch, getState }) => next => action => {
  //   ...
  //   return next(action);
  // };
  // 则 chain 中函数形如
  // next => action => {
  //   ...
  //   return next(action);
  // };
  // 即传入 redux 原生的 dispatch，返回一个新的 dispatch 并向下传递
  // 下一个中间件接收到新的 dispatch 后再返回一个新的 dispatch 并向下传递，以此类推
  // 调用过程中最后才调用 redux 原生的 dispatch
  const chain = middlewares.map((middleware) => middleware(middlewareAPI));
  // 中间件组合完毕后将得到的 dispatch 覆盖之前用于阻止分发的 dispatch
  dispatch = compose(...chain)(store.dispatch);
  return {
    ...store,
    dispatch
  };
};
```

> `middlewareAPI` 中的 `dispatch` 和 `next` 的区别是 `next` 是调用上一个中间件传来的 dispatch，而前者则是从头开始调用中间件组合完毕后得到的 dispatch。

## bindActionCreators

`actionCreators: Function|Object` 一个 value 为 action creator 的对象。一个简便的方法是通过 ES6 的 `import * as reducers` 来获得。也可以传入一个函数。

`dispatch: Function` store 提供的 `dispatch` 函数。

`return: Function|Object` 该对象与参数对象形状相同，但是每个 action creator 都被包装在 `dispatch` 调用中。如果参数是函数，则返回值也是函数。

将 action creators 包装在 `dispatch` 调用中，以便可以直接调用它们。

```js
// action creator 函数类似
function addTodo(text) {
  return {
    type: 'ADD_TODO',
    text
  };
}
// 返回一个 action
```

```js
function bindActionCreators(actionCreators, dispatch) {
  // ...
}
```

`actionCreators` 是函数则直接调用 `bindActionCreator` 并返回

```js
if (typeof actionCreators === 'function') {
  return bindActionCreator(actionCreators, dispatch);
}
```

### bindActionCreator

用 `dispatch` 包装 action creator。

```js
function bindActionCreator(actionCreator, dispatch) {
  return function() {
    return dispatch(actionCreator.apply(this, arguments));
  };
}
```

`actionCreators` 参数不符合要求时抛出错误。

```js
if (typeof actionCreators !== 'object' || actionCreators === null) {
  throw new Error(
    `bindActionCreators expected an object or a function, instead received ${
      actionCreators === null ? 'null' : typeof actionCreators
    }. ` +
      `Did you write "import ActionCreators from" instead of "import * as ActionCreators from"?`
  );
}
```

构建返回值，过滤掉 value 不是函数的项。

```js
const boundActionCreators = {};
for (const key in actionCreators) {
  const actionCreator = actionCreators[key];
  if (typeof actionCreator === 'function') {
    boundActionCreators[key] = bindActionCreator(actionCreator, dispatch);
  }
}
return boundActionCreators;
```
