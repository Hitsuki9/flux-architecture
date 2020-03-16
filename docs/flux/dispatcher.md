# Dispatcher

一个应用只需要一个 dispatcher 作为分发中心，管理所有数据的流向，分发 actions 给 stores。

dispatcher 用于将 payloads 分发到 stores 注册的回调函数中，这与一般的发布/订阅模式有两个不同之处：

- 回调函数没有订阅特定的事件，每个 payload 都会被分发给所有的回调函数。

- 回调函数可以指定在其它回调函数执行完毕之后调用。

## API

- `register(function callback): string` 注册一个回调函数，返回一个供 `waitFor()` 使用的 token。

- `unregister(string id): void` 通过 token 移除回调函数。

- `waitFor(array<string> ids): void` 在指定的回调函数执行完毕之后才执行当前的回调函数。该方法应仅由响应 payloads 的回调函数使用。

- `dispatch(object payload): void` 将一个 payload 分发给所有注册的回调函数。

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

  _invokeCallback(id) {
    this._isPending[id] = true;
    this._callbacks[id](this._pendingPayload);
    this._isHandled[id] = true;
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

### waitFor

```js
waitFor(ids) {
  invariant(
    this._isDispatching,
    'Dispatcher.waitFor(...): Must be invoked while dispatching.'
  );
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
