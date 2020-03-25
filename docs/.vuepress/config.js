module.exports = {
  title: 'Flux Architecture',
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
      '/vuex/': ['', 'source-code']
    }
  },
  markdown: {
    lineNumbers: true
  }
};
