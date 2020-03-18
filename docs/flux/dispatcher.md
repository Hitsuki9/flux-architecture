# Dispatcher

一个应用只需要一个 dispatcher 作为分发中心，管理所有数据的流向，分发 actions 给 stores。

dispatcher 用于将 actions 分发到 stores 注册的回调函数中，这与一般的发布/订阅模式有两个不同之处：

- 回调函数没有订阅特定的事件，每个 action 都会被分发给所有的回调函数。

- 回调函数可以指定在其它回调函数执行完毕之后调用。

## API

- `register(function callback): string` 注册一个回调函数，返回一个供 `waitFor()` 使用的 token。

- `unregister(string id): void` 通过 token 移除回调函数。

- `waitFor(array<string> ids): void` 在指定的回调函数执行完毕之后才执行当前的回调函数。该方法只能在分发中时由回调函数使用。

- `dispatch(object payload): void` 将一个 payload 分发给所有注册的回调函数并调用它们。

- `isDispatching(): boolean` 返回 dispatcher 当前是否处在分发的状态。

```js
var _prefix = 'ID_';

class Dispatcher {
  constructor() {
    this._callbacks = {};
    this._isDispatching = false;
    this._isHandled = {};
    this._isPending = {};
    this._lastID = 1;
  }

  // 调用回调函数
  _invokeCallback(id) {
    this._isPending[id] = true;
    this._callbacks[id](this._pendingPayload);
    this._isHandled[id] = true;
  }

  // 开始分发，缓存 payload
  _startDispatching(payload) {
    for (var id in this._callbacks) {
      this._isPending[id] = false;
      this._isHandled[id] = false;
    }
    this._pendingPayload = payload;
    this._isDispatching = true;
  }

  // 结束分发，清除 payload 缓存
  _stopDispatching() {
    delete this._pendingPayload;
    this._isDispatching = false;
  }
}
```

### register

```js
register(callback) {
  var id = _prefix + this._lastID++;
  this._callbacks[id] = callback;
  return id;
}
```

### unregister

```js
unregister(id) {
  invariant(
    this._callbacks[id],
    'Dispatcher.unregister(...): `%s` does not map to a registered callback.',
    id
  );
  delete this._callbacks[id];
}
```

### dispatch

```js
dispatch(payload) {
  invariant(
    !this._isDispatching,
    'Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch.'
  );
  this._startDispatching(payload);
  try {
    // 调用所有注册的回调函数
    for (var id in this._callbacks) {
      if (this._isPending[id]) {
        continue;
      }
      this._invokeCallback(id);
    }
  } finally {
    this._stopDispatching();
  }
}
```

### waitFor

```js
waitFor(ids) {
  invariant(
    this._isDispatching,
    'Dispatcher.waitFor(...): Must be invoked while dispatching.'
  );
  // 调用指定的回调函数
  for (var ii = 0; ii < ids.length; ii++) {
    var id = ids[ii];
    if (this._isPending[id]) {
      invariant(
        this._isHandled[id],
        'Dispatcher.waitFor(...): Circular dependency detected while ' +
        'waiting for `%s`.',
        id
      );
      continue;
    }
    invariant(
      this._callbacks[id],
      'Dispatcher.waitFor(...): `%s` does not map to a registered callback.',
      id
    );
    this._invokeCallback(id);
  }
}
```

### isDispatching

```js
isDispatching() {
  return this._isDispatching;
}
```
