## 概述

Flux 应用程序包含三个主要部分：`dispatcher`，`stores` 和 `views`（React 组件），不要把它与 `Model-View-Controller` 进行混淆。`controllers` 虽然确实存在于 Flux 应用程序中，但它们是 `controller-views`——这些 `views` 通常位于层次结构的顶部，并从 `stores` 中检索数据然后将数据传递给其子级。此外，`action creators`（`dispatcher` 帮助方法）用于提供描述应用程序中所有可能发生的更改的语义化的 API，将其视为 Flux 的第四部分可能会有所帮助。

Flux 避免使用 MVC 来支持单向数据流。当用户与 React 视图进行交互时，该视图将通过 `dispatcher` 将 `action` 传播到保存应用程序数据和业务逻辑的各个 `stores` 中，并且这些 `stores` 将更新所有受影响的视图。`store` 发送的视图更新通知不需要指定如何在状态之间转换视图这一点对于 React 的声明式编程风格来说非常契合。

`stores` 接受更新并进行适当的协调，而不是依靠外部事物以一致的方式更新其数据。`store` 外部的任何事物都无法深入了解其如何管理域中的数据，这有助于将关注点清晰地分离开来。`stores` 没有像 `setAsRead()` 这样的 `setter` 方法，但是只有一种将新数据带入其中的方法——通过 `dispatcher` 注册的 `callback`。

## 结构和数据流

Flux 应用程序中的数据沿单一方向流动：

![单向数据流1](../assets/images/flux1.png)

单向数据流是 Flux 模式的核心。`dispatcher`，`stores` 和 `views` 是具有不同输入和输出的独立节点，`actions` 是包含了新数据和用于标识的 `type` 属性的简单对象。

`views` 可能会因为响应用户交互而产生一个新的 `action`：

![单向数据流2](../assets/images/flux2.png)

所有的数据都流经 `dispatcher`。`actions` 是通过 `action creator` 方法提供给 `dispatcher` 的，并且其通常来自于用户与视图的交互。然后 `dispatcher` 调用 `stores` 中已经注册的 `callback`，从而将 `actions` 派发到所有的 `stores`。在已注册的 `callback` 中，`stores` 将响应与它们维护的数据相关的任何 `actions`。然后，`stores` 触发 `change` 事件，以通知 `controller-views` 发生了一个数据层面的更改。`controller-views` 监听这些事件，并在事件处理程序中检索 `stores` 中的数据。`controller-views` 调用其自己的 `setState()` 方法，这会触发相关组件及其子组件的重新渲染。

![单向数据流3](../assets/images/flux3.png)
