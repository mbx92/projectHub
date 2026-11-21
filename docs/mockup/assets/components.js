/* Komponen bersama: UiSelect, UiSearchSelect, UiDate */

window.DC_COMPONENTS = {};

window.DC_COMPONENTS["ui-select"] = DC.define((function () {

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.uid = 'sel-' + Math.random().toString(36).slice(2, 8);
    this.state = { open: false, up: false, active: -1, value: props.value === undefined ? (props.options === undefined ? 'Berjalan' : null) : props.value };
  }
  componentDidUpdate(prev) {
    if (prev.value !== this.props.value && this.props.value !== this.state.value) this.setState({ value: this.props.value });
  }
  opts() {
    var raw = this.props.options === undefined ? 'Persiapan|Berjalan|Tertunda|Selesai' : this.props.options;
    var list = typeof raw === 'string' ? raw.split('|') : (raw || []);
    return list.map(function (o) {
      if (typeof o !== 'object') { var t = String(o).trim(); return { label: t, value: t }; }
      return Object.assign({ value: o.label }, o);
    });
  }
  openList(e) {
    var opts = this.opts();
    var r = e && e.currentTarget ? e.currentTarget.getBoundingClientRect() : null;
    var need = Math.min(288, opts.length * 44 + 8) + 8;
    var up = !!r && window.innerHeight - r.bottom < need && r.top > need;
    var cur = opts.findIndex(function (o) { return o.value === this.state.value; }, this);
    this.setState({ open: true, up: up, active: cur >= 0 ? cur : opts.findIndex(function (o) { return !o.disabled; }) });
  }
  pick(i) {
    var o = this.opts()[i];
    if (!o || o.disabled) return;
    this.setState({ value: o.value, open: false });
    if (this.props.onChange) this.props.onChange(o.value, o);
  }
  move(dir) {
    var opts = this.opts(), n = opts.length, i = this.state.active;
    for (var k = 0; k < n; k++) { i = (i + dir + n) % n; if (!opts[i].disabled) break; }
    this.setState({ active: i });
  }
  renderVals() {
    var self = this, st = this.state, p = this.props;
    var opts = this.opts();
    var sel = opts.filter(function (o) { return o.value === st.value; })[0];
    var err = p.error || '';
    var dis = !!p.disabled;
    return {
      uid: this.uid,
      ariaLabel: (p.label === undefined || !!p.label) ? undefined : (p.ariaLabel || (p.placeholder || 'Pilih…')),
      listId: this.uid + '-list',
      label: p.label === undefined ? 'Status proyek' : p.label,
      hasLabel: p.label === undefined || !!p.label,
      open: st.open,
      invalid: err ? 'true' : undefined,
      disabled: dis,
      h: p.size === 'sm' ? 40 : 44,
      border: err ? '#D92D20' : st.open ? '#0B6E63' : dis ? '#E4E7EC' : '#D0D5DD',
      ring: st.open ? (err ? '0 0 0 4px #FEE4E2' : '0 0 0 4px #E6F4F1') : 'none',
      bg: dis ? '#F9FAFB' : '#FFFFFF',
      fg: sel && !dis ? '#101828' : '#667085',
      cursor: dis ? 'not-allowed' : 'pointer',
      chevron: st.open ? 'rotate(180deg)' : 'none',
      display: sel ? sel.label : (p.placeholder || 'Pilih…'),
      hasDot: !!(sel && sel.dot),
      dot: sel && sel.dot ? sel.dot : 'transparent',
      activeId: st.open && st.active >= 0 ? this.uid + '-o' + st.active : undefined,
      place: st.up ? 'bottom: calc(100% + 6px)' : 'top: calc(100% + 6px)',
      hasError: !!err,
      error: err,
      hasHint: !err && !!p.hint,
      hint: p.hint || '',
      toggle: function (e) { if (st.open) self.setState({ open: false }); else self.openList(e); },
      close: function () { self.setState({ open: false }); },
      onKey: function (e) {
        var k = e.key;
        if (k === 'Tab') { self.setState({ open: false }); return; }
        if (k === 'Escape') { self.setState({ open: false }); }
        else if (k === 'ArrowDown' || k === 'ArrowUp') { if (!st.open) self.openList(e); else self.move(k === 'ArrowDown' ? 1 : -1); }
        else if (k === 'Enter' || k === ' ') { if (st.open) self.pick(st.active); else self.openList(e); }
        else if (k === 'Home' && st.open) self.setState({ active: opts.findIndex(function (o) { return !o.disabled; }) });
        else return;
        e.preventDefault();
      },
      rows: opts.map(function (o, i) {
        var on = o.value === st.value, act = i === st.active;
        return {
          id: self.uid + '-o' + i, label: o.label, desc: o.desc || '', hasDesc: !!o.desc,
          dot: o.dot || 'transparent', hasDot: !!o.dot, sel: on, dis: !!o.disabled,
          bg: act && !o.disabled ? '#E6F4F1' : on ? '#F3FAF8' : 'transparent',
          fw: on ? 600 : 400, cursor: o.disabled ? 'not-allowed' : 'pointer', op: o.disabled ? 0.5 : 1,
          pick: function () { self.pick(i); },
          hover: function () { if (!o.disabled && st.active !== i) self.setState({ active: i }); }
        };
      })
    };
  }
}

return Component;
})(), "<div style=\"display: flex; flex-direction: column; gap: 6px; width: 100%; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #101828; text-align: left\">\n  <template v-if=\"v.hasLabel\">\n    <label :for=\"v.uid\" style=\"font-size: 13px; font-weight: 600; color: #344054\">{{ v.label }}<\/label>\n  <\/template>\n  <div style=\"position: relative\">\n    <button :id=\"v.uid\" type=\"button\" :aria-label=\"v.ariaLabel\" aria-haspopup=\"listbox\" :aria-expanded=\"v.open\" :aria-controls=\"v.listId\" :aria-activedescendant=\"v.activeId\" :aria-invalid=\"v.invalid\" :disabled=\"v.disabled\" @click=\"v.toggle\" @keydown=\"v.onKey\" :style=\"'display: flex; align-items: center; gap: 10px; width: 100%; min-height: ' + (v.h) + 'px; padding: 0 36px 0 12px; box-sizing: border-box; border: 1px solid ' + (v.border) + '; box-shadow: ' + (v.ring) + '; border-radius: 8px; background: ' + (v.bg) + '; font: inherit; font-size: 14px; color: ' + (v.fg) + '; text-align: left; cursor: ' + (v.cursor) + '; outline: none'\">\n      <template v-if=\"v.hasDot\"><span aria-hidden=\"true\" :style=\"'width: 8px; height: 8px; border-radius: 999px; background: ' + (v.dot) + '; flex: none'\"><\/span><\/template>\n      <span style=\"flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap\">{{ v.display }}<\/span>\n    <\/button>\n    <svg aria-hidden=\"true\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#475467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" :style=\"'position: absolute; right: 12px; top: 50%; margin-top: -8px; pointer-events: none; transform: ' + (v.chevron)\"><path d=\"M6 9l6 6 6-6\"><\/path><\/svg>\n    <template v-if=\"v.open\">\n      <button type=\"button\" tabindex=\"-1\" aria-label=\"Tutup pilihan\" @click=\"v.close\" style=\"position: fixed; inset: 0; z-index: 40; border: none; background: transparent; cursor: default\"><\/button>\n      <ul :id=\"v.listId\" role=\"listbox\" :aria-label=\"v.label\" :style=\"'position: absolute; left: 0; right: 0; ' + (v.place) + '; z-index: 41; min-width: 200px; max-height: 288px; overflow-y: auto; margin: 0; padding: 4px; list-style: none; background: #FFFFFF; border: 1px solid #E4E7EC; border-radius: 12px; box-shadow: 0 16px 32px rgba(16,24,40,0.14); box-sizing: border-box'\">\n        <template v-for=\"(o, $index) in v.rows\">\n          <li :id=\"o.id\" role=\"option\" :aria-selected=\"o.sel\" :aria-disabled=\"o.dis\" @click=\"o.pick\" @mouseenter=\"o.hover\" :style=\"'display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; font-size: 14px; background: ' + (o.bg) + '; cursor: ' + (o.cursor) + '; opacity: ' + (o.op)\">\n            <template v-if=\"o.hasDot\"><span aria-hidden=\"true\" :style=\"'width: 8px; height: 8px; border-radius: 999px; background: ' + (o.dot) + '; flex: none'\"><\/span><\/template>\n            <span style=\"flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px\">\n              <span :style=\"'font-weight: ' + (o.fw) + '; overflow: hidden; text-overflow: ellipsis; white-space: nowrap'\">{{ o.label }}<\/span>\n              <template v-if=\"o.hasDesc\"><span style=\"font-size: 12px; color: #475467\">{{ o.desc }}<\/span><\/template>\n            <\/span>\n            <template v-if=\"o.sel\"><svg aria-hidden=\"true\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0B6E63\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"flex: none\"><path d=\"M5 12l5 5L20 7\"><\/path><\/svg><\/template>\n          <\/li>\n        <\/template>\n      <\/ul>\n    <\/template>\n  <\/div>\n  <template v-if=\"v.hasError\"><span role=\"alert\" style=\"font-size: 13px; color: #B42318\">{{ v.error }}<\/span><\/template>\n  <template v-if=\"v.hasHint\"><span style=\"font-size: 13px; color: #475467\">{{ v.hint }}<\/span><\/template>\n<\/div>", ["ariaLabel", "clearable", "disabled", "error", "hint", "label", "min", "onChange", "options", "placeholder", "size", "value"]);

window.DC_COMPONENTS["ui-search-select"] = DC.define((function () {

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.uid = 'ss-' + Math.random().toString(36).slice(2, 8);
    this.state = { open: false, up: false, query: '', active: -1, value: props.value === undefined ? (props.options === undefined ? 'bumdes' : null) : props.value };
  }
  componentDidUpdate(prev) {
    if (prev.value !== this.props.value && this.props.value !== this.state.value) this.setState({ value: this.props.value });
  }
  opts() {
    var raw = this.props.options;
    if (raw === undefined) raw = [
      { label: 'Sistem Informasi BUMDes', value: 'bumdes', desc: 'BUMDes [Nama Desa] · 80%', group: 'Berjalan' },
      { label: 'POS Resto', value: 'pos', desc: '54DM Cafe · 25%', group: 'Berjalan' },
      { label: 'LMS Sekolah', value: 'lms', desc: '[Klien] · 45%', group: 'Berjalan' },
      { label: 'Sistem Klinik Pratama', value: 'klinik', desc: '[Klien] · 10%', group: 'Persiapan' },
      { label: 'Aplikasi Absensi Desa', value: 'absensi', desc: '[Klien] · 35%', group: 'Tertunda' }
    ];
    var list = typeof raw === 'string' ? raw.split('|') : raw;
    return list.map(function (o) {
      if (typeof o !== 'object') { var t = String(o).trim(); return { label: t, value: t }; }
      return Object.assign({ value: o.label }, o);
    });
  }
  filtered() {
    var q = (this.state.query || '').trim().toLowerCase();
    var list = this.opts().filter(function (o) { return !q || (o.label + ' ' + (o.desc || '')).toLowerCase().indexOf(q) !== -1; });
    var groups = [], map = {};
    list.forEach(function (o) { var g = o.group || ''; if (!map[g]) { map[g] = []; groups.push(g); } map[g].push(o); });
    return groups.reduce(function (acc, g) { return acc.concat(map[g]); }, []);
  }
  openList(e) {
    var r = e && e.currentTarget ? e.currentTarget.getBoundingClientRect() : null;
    var up = !!r && window.innerHeight - r.bottom < 380 && r.top > 380;
    var self = this;
    var list = this.filtered();
    var cur = list.findIndex(function (o) { return o.value === self.state.value; });
    this.setState({ open: true, up: up, query: '', active: cur >= 0 ? cur : 0 });
  }
  pick(o) {
    if (!o || o.disabled) return;
    this.setState({ value: o.value, open: false, query: '' });
    if (this.props.onChange) this.props.onChange(o.value, o);
  }
  renderVals() {
    var self = this, st = this.state, p = this.props;
    var q = (st.query || '').trim().toLowerCase();
    var list = this.filtered();
    var sel = this.opts().filter(function (o) { return o.value === st.value; })[0];
    var parts = function (text) {
      if (!q) return [{ t: text, m: false, n: true }];
      var out = [], lower = text.toLowerCase(), from = 0, at = lower.indexOf(q);
      while (at !== -1) {
        if (at > from) out.push({ t: text.slice(from, at), m: false, n: true });
        out.push({ t: text.slice(at, at + q.length), m: true, n: false });
        from = at + q.length; at = lower.indexOf(q, from);
      }
      if (from < text.length) out.push({ t: text.slice(from), m: false, n: true });
      return out;
    };
    var rows = [], last = null;
    list.forEach(function (o, i) {
      if (o.group && o.group !== last) rows.push({ isGroup: true, isOpt: false, label: o.group });
      last = o.group;
      var on = o.value === st.value, act = i === st.active;
      rows.push({
        isGroup: false, isOpt: true, id: self.uid + '-o' + i, label: o.label, parts: parts(o.label), desc: o.desc || '', hasDesc: !!o.desc,
        sel: on, dis: !!o.disabled, fw: on ? 600 : 400, cursor: o.disabled ? 'not-allowed' : 'pointer', op: o.disabled ? 0.5 : 1,
        bg: act && !o.disabled ? '#E6F4F1' : on ? '#F3FAF8' : 'transparent',
        pick: function () { self.pick(o); },
        hover: function () { if (st.active !== i) self.setState({ active: i }); }
      });
    });
    var move = function (dir) {
      var n = list.length; if (!n) return;
      var i = st.active;
      for (var k = 0; k < n; k++) { i = (i + dir + n) % n; if (!list[i].disabled) break; }
      self.setState({ active: i });
    };
    var footer = p.footer || '';
    return {
      uid: this.uid,
      ariaLabel: (p.label === undefined || !!p.label) ? undefined : (p.ariaLabel || (p.placeholder || 'Pilih…')),
      listId: this.uid + '-list',
      label: p.label === undefined ? 'Proyek' : p.label,
      hasLabel: p.label === undefined || !!p.label,
      open: st.open,
      h: p.size === 'sm' ? 40 : 44,
      border: st.open ? '#0B6E63' : '#D0D5DD',
      ring: st.open ? '0 0 0 4px #E6F4F1' : 'none',
      fg: sel ? '#101828' : '#667085',
      display: sel ? sel.label : (p.placeholder || 'Pilih…'),
      place: st.up ? 'bottom: calc(100% + 6px)' : 'top: calc(100% + 6px)',
      query: st.query,
      searchPlaceholder: p.searchPlaceholder || 'Cari…',
      searchLabel: 'Cari ' + (p.label || 'opsi').toLowerCase(),
      activeId: st.active >= 0 ? this.uid + '-o' + st.active : undefined,
      rows: rows,
      empty: list.length === 0,
      hasFooter: !!footer,
      footerText: footer + (q ? ' “' + st.query.trim() + '”' : ''),
      hasHint: !!p.hint,
      hint: p.hint || '',
      toggle: function (e) { if (st.open) self.setState({ open: false }); else self.openList(e); },
      close: function () { self.setState({ open: false, query: '' }); },
      onQuery: function (e) { self.setState({ query: e.target.value, active: 0 }); },
      onTriggerKey: function (e) {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].indexOf(e.key) !== -1) { e.preventDefault(); if (!st.open) self.openList(e); }
      },
      onSearchKey: function (e) {
        if (e.key === 'ArrowDown') move(1);
        else if (e.key === 'ArrowUp') move(-1);
        else if (e.key === 'Enter') self.pick(list[st.active]);
        else if (e.key === 'Escape') { if (st.query) self.setState({ query: '' }); else self.setState({ open: false }); }
        else if (e.key === 'Tab') { self.setState({ open: false }); return; }
        else return;
        e.preventDefault();
      }
    };
  }
}

return Component;
})(), "<div style=\"display: flex; flex-direction: column; gap: 6px; width: 100%; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #101828; text-align: left\">\n  <template v-if=\"v.hasLabel\">\n    <label :for=\"v.uid\" style=\"font-size: 13px; font-weight: 600; color: #344054\">{{ v.label }}<\/label>\n  <\/template>\n  <div style=\"position: relative\">\n    <button :id=\"v.uid\" type=\"button\" :aria-label=\"v.ariaLabel\" aria-haspopup=\"listbox\" :aria-expanded=\"v.open\" @click=\"v.toggle\" @keydown=\"v.onTriggerKey\" :style=\"'display: flex; align-items: center; gap: 10px; width: 100%; min-height: ' + (v.h) + 'px; padding: 0 36px 0 12px; box-sizing: border-box; border: 1px solid ' + (v.border) + '; box-shadow: ' + (v.ring) + '; border-radius: 8px; background: #FFFFFF; font: inherit; font-size: 14px; color: ' + (v.fg) + '; text-align: left; cursor: pointer; outline: none'\">\n      <span style=\"flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap\">{{ v.display }}<\/span>\n    <\/button>\n    <svg aria-hidden=\"true\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#475467\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"position: absolute; right: 12px; top: 50%; margin-top: -8px; pointer-events: none\"><path d=\"M7 15l5 5 5-5M7 9l5-5 5 5\"><\/path><\/svg>\n    <template v-if=\"v.open\">\n      <button type=\"button\" tabindex=\"-1\" aria-label=\"Tutup pilihan\" @click=\"v.close\" style=\"position: fixed; inset: 0; z-index: 40; border: none; background: transparent; cursor: default\"><\/button>\n      <div :style=\"'position: absolute; left: 0; right: 0; ' + (v.place) + '; z-index: 41; min-width: 260px; background: #FFFFFF; border: 1px solid #E4E7EC; border-radius: 12px; box-shadow: 0 16px 32px rgba(16,24,40,0.14); overflow: hidden'\">\n        <div style=\"padding: 8px; border-bottom: 1px solid #E4E7EC\">\n          <div style=\"display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border: 1px solid #0B6E63; box-shadow: 0 0 0 4px #E6F4F1; border-radius: 8px; background: #FFFFFF\">\n            <svg aria-hidden=\"true\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#475467\" stroke-width=\"2\" stroke-linecap=\"round\"><circle cx=\"11\" cy=\"11\" r=\"7\"><\/circle><path d=\"M20 20l-4-4\"><\/path><\/svg>\n            <input type=\"text\" role=\"combobox\" aria-expanded=\"true\" :aria-controls=\"v.listId\" :aria-activedescendant=\"v.activeId\" :aria-label=\"v.searchLabel\" v-focus autocomplete=\"off\" :value=\"v.query\" @input=\"v.onQuery\" @keydown=\"v.onSearchKey\" :placeholder=\"v.searchPlaceholder\" style=\"border: none; outline: none; font: inherit; font-size: 14px; width: 100%; background: transparent; color: #101828\">\n          <\/div>\n        <\/div>\n        <ul :id=\"v.listId\" role=\"listbox\" :aria-label=\"v.label\" style=\"margin: 0; padding: 4px; list-style: none; max-height: 260px; overflow-y: auto\">\n          <template v-for=\"(r, $index) in v.rows\">\n            <template v-if=\"r.isGroup\">\n              <li role=\"presentation\" style=\"padding: 10px 12px 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #475467\">{{ r.label }}<\/li>\n            <\/template>\n            <template v-if=\"r.isOpt\">\n              <li :id=\"r.id\" role=\"option\" :aria-selected=\"r.sel\" :aria-disabled=\"r.dis\" @click=\"r.pick\" @mouseenter=\"r.hover\" :style=\"'display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; font-size: 14px; background: ' + (r.bg) + '; cursor: ' + (r.cursor) + '; opacity: ' + (r.op)\">\n                <span style=\"flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px\">\n                  <span :style=\"'font-weight: ' + (r.fw)\"><template v-for=\"(pt, $index) in r.parts\"><template v-if=\"pt.m\"><mark style=\"background: #CCE9E3; color: inherit; border-radius: 2px\">{{ pt.t }}<\/mark><\/template><template v-if=\"pt.n\">{{ pt.t }}<\/template><\/template><\/span>\n                  <template v-if=\"r.hasDesc\"><span style=\"font-size: 12px; color: #475467\">{{ r.desc }}<\/span><\/template>\n                <\/span>\n                <template v-if=\"r.sel\"><svg aria-hidden=\"true\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0B6E63\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"flex: none\"><path d=\"M5 12l5 5L20 7\"><\/path><\/svg><\/template>\n              <\/li>\n            <\/template>\n          <\/template>\n          <template v-if=\"v.empty\">\n            <li role=\"presentation\" style=\"padding: 20px 12px; text-align: center; font-size: 14px; color: #475467\">Tidak ada hasil untuk “{{ v.query }}”<\/li>\n          <\/template>\n        <\/ul>\n        <template v-if=\"v.hasFooter\">\n          <div style=\"border-top: 1px solid #E4E7EC; padding: 4px\">\n            <button type=\"button\" @click=\"v.close\" style=\"display: flex; align-items: center; width: 100%; min-height: 40px; padding: 0 12px; border: none; border-radius: 8px; background: transparent; font: inherit; font-size: 14px; font-weight: 600; color: #08544B; cursor: pointer; text-align: left\">{{ v.footerText }}<\/button>\n          <\/div>\n        <\/template>\n      <\/div>\n    <\/template>\n  <\/div>\n  <template v-if=\"v.hasHint\"><span style=\"font-size: 13px; color: #475467\">{{ v.hint }}<\/span><\/template>\n<\/div>", ["ariaLabel", "clearable", "footer", "hint", "label", "min", "onChange", "options", "placeholder", "searchPlaceholder", "size", "value"]);

window.DC_COMPONENTS["ui-date"] = DC.define((function () {

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.uid = 'dt-' + Math.random().toString(36).slice(2, 8);
    this.state = { open: false, value: props.value === undefined ? '2026-11-30' : (props.value || null), draft: null, view: null, up: false, right: false, hover: null };
  }
  componentDidUpdate(prev) {
    if (prev.value !== this.props.value && (this.props.value || null) !== this.state.value) this.setState({ value: this.props.value || null });
  }
  mode() { return this.props.mode || 'date'; }
  parse(v) {
    var mode = this.mode();
    if (!v) return { date: null, h: 9, m: 0 };
    if (mode === 'time') { var t = v.split(':'); return { date: null, h: Number(t[0]) || 0, m: Number(t[1]) || 0 }; }
    var parts = v.split('T'), hm = (parts[1] || '09:00').split(':');
    return { date: parts[0], h: Number(hm[0]) || 0, m: Number(hm[1]) || 0 };
  }
  format(d) {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var mode = this.mode();
    var t = pad(d.h) + ':' + pad(d.m);
    if (mode === 'time') return t;
    if (!d.date) return null;
    return mode === 'date' ? d.date : d.date + 'T' + t;
  }
  commit(d) {
    var v = this.format(d);
    this.setState({ value: v, open: false, draft: null });
    if (this.props.onChange) this.props.onChange(v);
  }
  openPanel(e) {
    var d = this.parse(this.state.value);
    var base = d.date ? d.date.split('-').map(Number) : null;
    var now = new Date();
    var r = e && e.currentTarget ? e.currentTarget.getBoundingClientRect() : null;
    var mode = this.mode();
    var h = mode === 'date' ? 380 : 400, w = mode === 'datetime' ? 430 : mode === 'time' ? 150 : 292;
    this.setState({
      open: true, draft: d, hover: null,
      view: base ? [base[0], base[1] - 1] : [now.getFullYear(), now.getMonth()],
      up: !!r && window.innerHeight - r.bottom < h && r.top > h,
      right: !!r && r.left + w > window.innerWidth - 8
    });
  }
  renderVals() {
    var self = this, st = this.state, p = this.props, mode = this.mode();
    var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    var MS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var now = new Date(), today = ymd(now);
    var min = p.min === 'today' ? today : (p.min || '');
    var hasDate = mode !== 'time', hasTime = mode !== 'date';
    var cur = this.parse(st.value);
    var draft = st.draft || cur;
    var dateText = function (s) { var a = s.split('-'); return Number(a[2]) + ' ' + MS[Number(a[1]) - 1] + ' ' + a[0]; };
    var display = '';
    if (st.value) display = mode === 'time' ? pad(cur.h) + '.' + pad(cur.m) : mode === 'date' ? dateText(cur.date) : dateText(cur.date) + ', ' + pad(cur.h) + '.' + pad(cur.m);
    var ph = p.placeholder || (mode === 'time' ? 'Pilih jam' : mode === 'datetime' ? 'Pilih tanggal & jam' : 'Pilih tanggal');
    var view = st.view || [now.getFullYear(), now.getMonth()];
    var vy = view[0], vm = view[1];
    var first = new Date(vy, vm, 1);
    var start = new Date(vy, vm, 1 - (first.getDay() + 6) % 7);
    var days = [];
    for (var i = 0; i < 42; i++) {
      var dd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var k = ymd(dd), sel = k === draft.date, off = !!min && k < min, inM = dd.getMonth() === vm, hov = st.hover === k && !sel && !off;
      days.push({
        day: dd.getDate(), sel: sel, off: off, dot: k === today && !sel, current: k === today ? 'date' : undefined,
        aria: dd.getDate() + ' ' + MONTHS[dd.getMonth()] + ' ' + dd.getFullYear(),
        bg: sel ? '#0B6E63' : hov ? '#E6F4F1' : 'transparent',
        fg: sel ? '#FFFFFF' : off ? '#C4C9D1' : inM ? '#101828' : '#667085',
        fw: sel ? 700 : 400, deco: off ? 'line-through' : 'none', cursor: off ? 'not-allowed' : 'pointer',
        pick: (function (key) { return function () {
          var nd = Object.assign({}, draft, { date: key });
          if (mode === 'date') self.commit(nd); else self.setState({ draft: nd });
        }; })(k),
        hover: (function (key) { return function () { if (self.state.hover !== key) self.setState({ hover: key }); }; })(k)
      });
    }
    var cell = function (label, on, pick) { return { label: label, sel: on, pick: pick, bg: on ? '#0B6E63' : 'transparent', fg: on ? '#FFFFFF' : '#101828', fw: on ? 700 : 400 }; };
    var hours = [], mins = [];
    for (var h = 0; h < 24; h++) hours.push(cell(pad(h), draft.h === h, (function (x) { return function () { self.setState({ draft: Object.assign({}, draft, { h: x }) }); }; })(h)));
    for (var m = 0; m < 60; m += 5) mins.push(cell(pad(m), draft.m === m, (function (x) { return function () { self.setState({ draft: Object.assign({}, draft, { m: x }) }); }; })(m)));
    var clearable = p.clearable !== false && !!st.value;
    return {
      uid: this.uid,
      ariaLabel: (p.label === undefined || !!p.label) ? undefined : (p.ariaLabel || ph),
      label: p.label === undefined ? 'Tanggal bayar' : p.label,
      hasLabel: p.label === undefined || !!p.label,
      dialogLabel: 'Pilih ' + (p.label || ph).toLowerCase(),
      open: st.open,
      h: p.size === 'sm' ? 40 : 44,
      padR: clearable ? 40 : 12,
      border: st.open ? '#0B6E63' : '#D0D5DD',
      ring: st.open ? '0 0 0 4px #E6F4F1' : 'none',
      fg: st.value ? '#101828' : '#667085',
      icon: mode === 'time' ? 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2' : 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
      display: display || ph,
      canClear: clearable,
      clear: function () { self.setState({ value: null }); if (p.onChange) p.onChange(null); },
      placeY: st.up ? 'bottom: calc(100% + 6px)' : 'top: calc(100% + 6px)',
      placeX: st.right ? 'right: 0' : 'left: 0',
      hasDate: hasDate,
      hasTime: hasTime,
      timeBorder: hasDate ? '1px solid #E4E7EC' : 'none',
      timePad: hasDate ? '12px' : '0',
      monthLabel: MONTHS[vm] + ' ' + vy,
      prevMonth: function () { var d = new Date(vy, vm - 1, 1); self.setState({ view: [d.getFullYear(), d.getMonth()] }); },
      nextMonth: function () { var d = new Date(vy, vm + 1, 1); self.setState({ view: [d.getFullYear(), d.getMonth()] }); },
      weekdays: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
      days: days,
      unhover: function () { if (self.state.hover) self.setState({ hover: null }); },
      hours: hours,
      mins: mins,
      nowLabel: mode === 'date' ? 'Hari ini' : 'Sekarang',
      setNow: function () {
        var nd = { date: today, h: now.getHours(), m: Math.floor(now.getMinutes() / 5) * 5 };
        if (mode === 'date') self.commit(nd); else self.setState({ draft: nd, view: [now.getFullYear(), now.getMonth()] });
      },
      apply: function () { if (mode === 'datetime' && !draft.date) return; self.commit(draft); },
      hasHint: !!p.hint,
      hint: p.hint || '',
      toggle: function (e) { if (st.open) self.setState({ open: false, draft: null }); else self.openPanel(e); },
      close: function () { self.setState({ open: false, draft: null }); },
      onTriggerKey: function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); if (!st.open) self.openPanel(e); } else if (e.key === 'Escape') self.setState({ open: false, draft: null }); },
      onPanelKey: function (e) { if (e.key === 'Escape') { e.preventDefault(); self.setState({ open: false, draft: null }); } }
    };
  }
}

return Component;
})(), "<div style=\"display: flex; flex-direction: column; gap: 6px; width: 100%; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #101828; text-align: left\">\n  <template v-if=\"v.hasLabel\">\n    <label :for=\"v.uid\" style=\"font-size: 13px; font-weight: 600; color: #344054\">{{ v.label }}<\/label>\n  <\/template>\n  <div style=\"position: relative\">\n    <button :id=\"v.uid\" type=\"button\" :aria-label=\"v.ariaLabel\" aria-haspopup=\"dialog\" :aria-expanded=\"v.open\" @click=\"v.toggle\" @keydown=\"v.onTriggerKey\" :style=\"'display: flex; align-items: center; gap: 10px; width: 100%; min-height: ' + (v.h) + 'px; padding: 0 ' + (v.padR) + 'px 0 12px; box-sizing: border-box; border: 1px solid ' + (v.border) + '; box-shadow: ' + (v.ring) + '; border-radius: 8px; background: #FFFFFF; font: inherit; font-size: 14px; color: ' + (v.fg) + '; text-align: left; cursor: pointer; outline: none; white-space: nowrap'\">\n      <svg aria-hidden=\"true\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#475467\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"flex: none\"><path :d=\"v.icon\"><\/path><\/svg>\n      <span style=\"flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis\">{{ v.display }}<\/span>\n    <\/button>\n    <template v-if=\"v.canClear\">\n      <button type=\"button\" aria-label=\"Hapus nilai\" @click=\"v.clear\" style=\"position: absolute; right: 4px; top: 50%; margin-top: -16px; width: 32px; height: 32px; border: none; border-radius: 6px; background: transparent; color: #475467; cursor: pointer; display: flex; align-items: center; justify-content: center\">\n        <svg aria-hidden=\"true\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M6 6l12 12M18 6L6 18\"><\/path><\/svg>\n      <\/button>\n    <\/template>\n    <template v-if=\"v.open\">\n      <button type=\"button\" tabindex=\"-1\" aria-label=\"Tutup kalender\" @click=\"v.close\" style=\"position: fixed; inset: 0; z-index: 40; border: none; background: transparent; cursor: default\"><\/button>\n      <div role=\"dialog\" :aria-label=\"v.dialogLabel\" @keydown=\"v.onPanelKey\" :style=\"'position: absolute; ' + (v.placeY) + '; ' + (v.placeX) + '; z-index: 41; width: max-content; background: #FFFFFF; border: 1px solid #E4E7EC; border-radius: 12px; padding: 12px; box-shadow: 0 16px 32px rgba(16,24,40,0.14); display: flex; flex-direction: column; gap: 12px'\">\n        <div style=\"display: flex; gap: 12px\">\n          <template v-if=\"v.hasDate\">\n            <div style=\"width: 266px\">\n              <div style=\"display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px\">\n                <button type=\"button\" aria-label=\"Bulan sebelumnya\" @click=\"v.prevMonth\" style=\"width: 36px; height: 36px; border: none; border-radius: 8px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #344054\"><svg aria-hidden=\"true\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 18l-6-6 6-6\"><\/path><\/svg><\/button>\n                <span aria-live=\"polite\" style=\"font-size: 14px; font-weight: 600\">{{ v.monthLabel }}<\/span>\n                <button type=\"button\" aria-label=\"Bulan berikutnya\" @click=\"v.nextMonth\" style=\"width: 36px; height: 36px; border: none; border-radius: 8px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #344054\"><svg aria-hidden=\"true\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6l6 6-6 6\"><\/path><\/svg><\/button>\n              <\/div>\n              <div style=\"display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); justify-items: center\">\n                <template v-for=\"(w, $index) in v.weekdays\">\n                  <span aria-hidden=\"true\" style=\"height: 30px; display: flex; align-items: center; font-size: 12px; font-weight: 600; color: #667085\">{{ w }}<\/span>\n                <\/template>\n                <template v-for=\"(d, $index) in v.days\">\n                  <button type=\"button\" :aria-label=\"d.aria\" :aria-pressed=\"d.sel\" :aria-current=\"d.current\" :disabled=\"d.off\" @click=\"d.pick\" @mouseenter=\"d.hover\" @mouseleave=\"v.unhover\" :style=\"'position: relative; width: 36px; height: 36px; border: none; border-radius: 8px; font: inherit; font-size: 14px; background: ' + (d.bg) + '; color: ' + (d.fg) + '; font-weight: ' + (d.fw) + '; text-decoration: ' + (d.deco) + '; cursor: ' + (d.cursor)\">\n                    {{ d.day }}\n                    <template v-if=\"d.dot\"><span aria-hidden=\"true\" style=\"position: absolute; bottom: 4px; left: 16px; width: 4px; height: 4px; border-radius: 999px; background: #0B6E63\"><\/span><\/template>\n                  <\/button>\n                <\/template>\n              <\/div>\n            <\/div>\n          <\/template>\n          <template v-if=\"v.hasTime\">\n            <div :style=\"'display: flex; flex-direction: column; gap: 8px; border-left: ' + (v.timeBorder) + '; padding-left: ' + (v.timePad)\">\n              <div style=\"display: flex; gap: 4px; font-size: 12px; font-weight: 600; color: #475467\"><span style=\"width: 56px; text-align: center\">Jam<\/span><span style=\"width: 56px; text-align: center\">Menit<\/span><\/div>\n              <div style=\"display: flex; gap: 4px\">\n                <div role=\"listbox\" aria-label=\"Jam\" style=\"height: 252px; width: 56px; overflow-y: auto; background: #F9FAFB; border-radius: 8px; padding: 4px; box-sizing: border-box\">\n                  <template v-for=\"(t, $index) in v.hours\">\n                    <button type=\"button\" role=\"option\" :aria-selected=\"t.sel\" @click=\"t.pick\" :style=\"'display: flex; width: 100%; height: 36px; align-items: center; justify-content: center; border: none; border-radius: 6px; font: inherit; font-size: 14px; background: ' + (t.bg) + '; color: ' + (t.fg) + '; font-weight: ' + (t.fw) + '; cursor: pointer'\">{{ t.label }}<\/button>\n                  <\/template>\n                <\/div>\n                <div role=\"listbox\" aria-label=\"Menit\" style=\"height: 252px; width: 56px; overflow-y: auto; background: #F9FAFB; border-radius: 8px; padding: 4px; box-sizing: border-box\">\n                  <template v-for=\"(t, $index) in v.mins\">\n                    <button type=\"button\" role=\"option\" :aria-selected=\"t.sel\" @click=\"t.pick\" :style=\"'display: flex; width: 100%; height: 36px; align-items: center; justify-content: center; border: none; border-radius: 6px; font: inherit; font-size: 14px; background: ' + (t.bg) + '; color: ' + (t.fg) + '; font-weight: ' + (t.fw) + '; cursor: pointer'\">{{ t.label }}<\/button>\n                  <\/template>\n                <\/div>\n              <\/div>\n            <\/div>\n          <\/template>\n        <\/div>\n        <div style=\"display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid #E4E7EC; padding-top: 10px\">\n          <button type=\"button\" @click=\"v.setNow\" style=\"min-height: 36px; padding: 0 8px; border: none; border-radius: 6px; background: transparent; font: inherit; font-size: 14px; font-weight: 600; color: #08544B; cursor: pointer\">{{ v.nowLabel }}<\/button>\n          <template v-if=\"v.hasTime\">\n            <div style=\"display: flex; gap: 8px\">\n              <button type=\"button\" @click=\"v.close\" style=\"min-height: 36px; padding: 0 12px; border: 1px solid #D0D5DD; border-radius: 8px; background: #FFFFFF; font: inherit; font-size: 14px; font-weight: 600; color: #344054; cursor: pointer\">Batal<\/button>\n              <button type=\"button\" @click=\"v.apply\" style=\"min-height: 36px; padding: 0 12px; border: none; border-radius: 8px; background: #0B6E63; font: inherit; font-size: 14px; font-weight: 600; color: #FFFFFF; cursor: pointer\">Terapkan<\/button>\n            <\/div>\n          <\/template>\n        <\/div>\n      <\/div>\n    <\/template>\n  <\/div>\n  <template v-if=\"v.hasHint\"><span style=\"font-size: 13px; color: #475467\">{{ v.hint }}<\/span><\/template>\n<\/div>", ["ariaLabel", "clearable", "hint", "label", "min", "mode", "onChange", "placeholder", "size", "value"]);
