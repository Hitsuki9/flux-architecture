# 概述

Flux 应用包含三个主要部分：dispatcher，stores 和 views（React 组件）。当用户与 React 视图进行交互时，该视图将通过 dispatcher 将 action 分发到存储应用状态和逻辑的各个 stores 中，然后这些 stores 将通知所有受影响的视图进行更新。

stores 外部的任何事物都无法深入了解其内部是如何管理状态的，这有助于将关注点分离开来。stores 只有一种将新数据传入其内部的方法——通过注册给 dispatcher 的回调函数。

## 结构和数据流

**Flux 架构的出现主要是为了解决 MVC 架构混乱的数据流动方式这一问题而总结出来的一套模式**。

Flux 应用中的数据沿单一方向流动：

![单向数据流1](../assets/images/flux1.png)

单向数据流是 Flux 模式的核心。dispatcher，stores 和 views 是具有不同输入和输出的独立节点，actions 是包含了新数据和用于标识的 type 属性的简单对象。

views 可能会因为用户交互而产生一个新的 action：

![单向数据流2](../assets/images/flux2.png)

所有的数据都流经 dispatcher。actions 是通过 action creator 方法提供给 dispatcher 的，并且通常都来自于用户与视图的交互。然后 dispatcher 调用 stores 注册的回调函数，将 actions 分发给所有的 stores，stores 将响应匹配到的对应 type 的 actions。然后，stores 触发 change 事件，以通知 views 发生了一个数据层面的更改。而 views 则监听 change 事件，并在事件处理程序中获取 stores 中的新状态，并调用其自己的 `setState()` 方法，触发相关组件及其子组件的重渲染。

![单向数据流3](../assets/images/flux3.png)

应用的状态仅在 stores 中维护，从而使应用的不同部分保持高度分离。stores 之间确实可能存在依赖关系，但它们都被 dispatcher 管理并同步更新。

> 双向数据绑定会导致级联的更新，即其中一个对象的更改会导致另一对象的更改，但也可能触发更多的更新。随着应用的复杂度不断提高，这些级联的更新将使得我们很难预测由于一次用户交互而引发的变化。而当数据只能在一个周期内被更新时，整个系统都将变得更加可预测。
