/* Runtime kecil: menjalankan komponen gaya DCLogic di atas Vue 3. */
window.DCLogic = class DCLogic {
  constructor(props) { this.props = props; this.state = {}; }
  setState(patch) {
    var next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    Object.assign(this.state, next);
  }
  forceUpdate() {}
};
window.DC = {
  define: function (Cls, template, propNames) {
    return {
      props: propNames,
      inheritAttrs: false,
      template: template,
      setup: function (props) {
        var inst = new Cls(props);
        inst.props = props;
        inst.state = Vue.reactive(inst.state || {});
        if (inst.componentDidUpdate) {
          var prev = Object.assign({}, props);
          Vue.watch(function () { return Object.assign({}, props); }, function (nv) {
            var pv = prev; prev = Object.assign({}, nv); inst.componentDidUpdate(pv, {});
          });
        }
        if (inst.componentDidMount) Vue.onMounted(function () { inst.componentDidMount(); });
        if (inst.componentWillUnmount) Vue.onBeforeUnmount(function () { inst.componentWillUnmount(); });
        var v = Vue.computed(function () { return inst.renderVals(); });
        return { v: v };
      }
    };
  },
  mount: function (selector, Cls, template) {
    var app = Vue.createApp(DC.define(Cls, template, []));
    app.directive('focus', { mounted: function (el) { el.focus(); } });
    Object.keys(window.DC_COMPONENTS || {}).forEach(function (n) { app.component(n, window.DC_COMPONENTS[n]); });
    app.mount(selector);
  }
};
