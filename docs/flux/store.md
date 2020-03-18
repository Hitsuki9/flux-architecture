# Store

stores 包含应用的状态和逻辑，不同的 store 管理应用中不同部分的状态。它们的作用与传统的 MVC 中的 model 有些类似。

```js
class TodoStore {
  constructor(dispatcher) {
    this.__changed = false;
    this.__changeEvent = 'change';
    this.__dispatcher = dispatcher;
    this.__emitter = new EventEmitter();
    // 注册回调函数
    this._dispatchToken = dispatcher.register((payload) => {
      this.__invokeOnDispatch(payload);
    });
    this._state = this.getInitialState();
  }

  // 供容器组件监听 change 事件
  addListener(callback) {
    return this.__emitter.addListener(this.__changeEvent, callback);
  }

  // 初始化 state
  getInitialState() {
    return Immutable.OrderedMap(); // 返回一个不可变的有序 map
  }

  // 浅比较
  areEqual(one, two) {
    return one === two;
  }

  __invokeOnDispatch(action) {
    this.__changed = false;

    const startingState = this._state; // 更新前的 state
    const endingState = this.reduce(startingState, action); // 更新后的 state

    invariant(
      endingState !== undefined,
      '%s returned undefined from reduce(...), did you forget to return ' +
        'state in the default case? (use null if this was intentional)',
      this.constructor.name
    );

    // 前后 state 浅比较不相等时才触发 change 事件
    if (!this.areEqual(startingState, endingState)) {
      this._state = endingState;
      this.__emitChange();
    }

    if (this.__changed) {
      // 触发 change 事件
      this.__emitter.emit(this.__changeEvent);
    }
  }

  __emitChange() {
    invariant(
      this.__dispatcher.isDispatching(),
      '%s.__emitChange(): Must be invoked while dispatching.',
      this.__className
    );
    this.__changed = true;
  }

  reduce(state, action) {
    switch (action.type) {
      case TodoActionTypes.ADD_TODO:
        if (!action.text) {
          return state;
        }
        const id = Counter.increment();
        return state.set(
          id,
          new Todo({
            id,
            text: action.text,
            complete: false
          })
        );

      case TodoActionTypes.DELETE_COMPLETED_TODOS:
        return state.filter((todo) => !todo.complete);

      case TodoActionTypes.DELETE_TODO:
        return state.delete(action.id);

      // ...

      default:
        return state;
    }
  }
}
```

stores 注册的回调函数将会接收 action。因为每个 action 都会分发给所有注册的回调函数，所以回调函数里要判断这个 action 的 type 并调用相关的内部方法处理 action 带过来的数据（payload），然后再通知 view 进行更新。

唯一更新数据的手段就是通过注册给 dispatcher 的回调函数。
