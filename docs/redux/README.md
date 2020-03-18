# 概述

Redux 是 Flux 架构的一种实现，同时又在其基础上做了改进。Redux 还是秉承了 Flux 单向数据流、store 是唯一的数据源的思想。

## 与 Flux 的区别

- Redux 只有一个 store。

Flux 中允许有多个 store，但是 Redux 中只允许有一个，相较于 Flux，一个 store 更加清晰且容易管理。同时，Redux 中更新状态的逻辑也不在 store 中而是放到了 reducer 中。

单一 store 带来的好处是所有数据集中化处理，而不像 Flux，当 stores 之间存在依赖关系时，还需要调度状态更新逻辑的执行顺序。

- Redux 中没有 dispatcher 的概念。

Redux 去除了 dispatcher，使用 store 的 `dispatch()` 方法来把 actions 传给 store。由于所有的 actions 都会经过这个 `dispatch()` 方法，Redux 利用这一点实现了与 Koa 类似的 middleware 机制，middleware 可以让从 actions 被 dispatch 后到到达 store 的这一过程被拦截并运行插入的代码来任意操作 actions 和 <!-- TODO -->store，这可以很容易地实现日志打印、错误收集、API 请求等功能。

## Redux 设计和使用的三大原则

- 单一数据源

在 Redux 的思想中，一个应用永远只有唯一的数据源，使用单一数据源的好处在于整个应用的状态都保存在一个对象中，我们可以随时提取出整个应用的状态并进行持久化，这样的设计也为 SSR 提供了可能。

- 状态是只读的

状态是只读的这与 Flux 的思想相同，在 Redux 中不会直接改变应用的状态，而是会返回一个全新的状态。

- 状态修改均由纯函数完成

Redux 通过纯函数 reducer 来更新状态，因为 reducer 是纯函数，返回的是一个全新的 state 而不会改变原有的 state，所以可以做到跟踪每一次触发 action 而改变状态的结果，即 time travel。
