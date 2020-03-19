module.exports = {
  title: 'Flux 架构',
  base: '/flux-architecture/',
  // configureWebpack: {},
  themeConfig: {
    sidebarDepth: 2,
    displayAllHeaders: true,
    nav: [
      { text: 'Flux', link: '/flux/' },
      { text: 'Redux', link: '/redux/' },
      { text: 'Vuex', link: '/vuex/' }
    ],
    sidebar: {
      '/flux/': ['', 'dispatcher', 'action', 'store', 'view'],
      '/redux/': ['', 'source-code'],
      '/vuex/': ['']
    }
  },
  markdown: {
    lineNumbers: true
  }
};
