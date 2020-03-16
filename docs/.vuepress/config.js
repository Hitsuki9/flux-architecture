module.exports = {
  title: 'Flux 架构',
  base: '/flux-architecture/',
  configureWebpack: {},
  themeConfig: {
    sidebarDepth: 2,
    displayAllHeaders: true,
    nav: [
      { text: 'Flux', link: '/flux/' },
      { text: 'Redux', link: '/redux/' }
    ],
    sidebar: {
      '/flux/': ['', 'dispatcher']
    },
    lastUpdated: 'Last Updated'
  },
  markdown: {
    lineNumbers: true
  }
};
