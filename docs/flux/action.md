# Action

通过定义一些 action creator 方法来创建 actions，并通过 `dispatch` 分发对应的 action，这些方法用来暴露给外部调用。

actions 可能来自于用户交互，也可能来自于服务器等。

```js
import TodoActionTypes from './TodoActionTypes'; // action types 集合
import TodoDispatcher from './TodoDispatcher'; // Dispatcher 实例

const Actions = {
  addTodo(text) {
    TodoDispatcher.dispatch({
      type: TodoActionTypes.ADD_TODO,
      text
    });
  },

  deleteCompletedTodos() {
    TodoDispatcher.dispatch({
      type: TodoActionTypes.DELETE_COMPLETED_TODOS
    });
  },

  deleteTodo(id) {
    TodoDispatcher.dispatch({
      type: TodoActionTypes.DELETE_TODO,
      id
    });
  }
  // ...
};
```

所谓 action 其实就是用来封装传递的数据的，action 只是一个简单的对象，包含两部分：payload 和 type。payload 是数据主体，而 type 则用来标识 action。
