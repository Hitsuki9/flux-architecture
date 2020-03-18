# View

views 就是 React 组件，从 stores 获取状态（数据）并绑定 change 事件。

## 容器组件

容器组件又称作控制器视图（controller-views）。

```js
function getStores() {
  return [TodoEditStore, TodoDraftStore, TodoStore];
}

function getState() {
  return {
    draft: TodoDraftStore.getState(),
    editing: TodoEditStore.getState(),
    todos: TodoStore.getState(),

    onAdd: TodoActions.addTodo,
    onDeleteCompletedTodos: TodoActions.deleteCompletedTodos,
    onDeleteTodo: TodoActions.deleteTodo
    // ...
  };
}

// 传入展示组件，生成容器组件
// 容器组件能获得 stores 和 state，并将 state 作为 props 传入展示组件
// 容器组件在初始化时监听 stores 的 change 事件
// 并将包含 setState 的回调函数（即用于更新视图的回调函数）注册到 dispatcher
// 当 dispatcher 接收到 action 时，用于更新视图的回调函数会先调用 waitFor 等待更新状态的回调函数执行完毕
// 然后才执行自身逻辑从而更新视图
Container.createFunctional(/** 展示组件 */ AppView, getStores, getState);
```

## 展示组件

```js
// props 由容器组件传入，并透传至其子组件
function AppView(props) {
  return (
    <div>
      <Header {...props} />
      <Main {...props} />
      <Footer {...props} />
    </div>
  );
}

function Header(props) {
  return (
    <header id="header">
      <h1>todos</h1>
      <NewTodo {...props} />
    </header>
  );
}

function NewTodo(props) {
  const addTodo = () => props.onAdd(props.draft);
  const onBlur = () => addTodo();
  const onChange = (event) => props.onUpdateDraft(event.target.value);
  const onKeyDown = (event) => {
    if (event.keyCode === ENTER_KEY_CODE) {
      addTodo();
    }
  };
  return (
    <input
      autoFocus={true}
      id="new-todo"
      placeholder="What needs to be done?"
      value={props.draft} // 从 store 中获得的数据
      onBlur={onBlur} // 触发事件将分发一个 action
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  );
}
```

一个 view 可能关联多个 store 来管理不同部分的状态。
