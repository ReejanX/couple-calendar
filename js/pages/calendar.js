(function (global) {
  "use strict";

  global.CoupleCalendarPages = global.CoupleCalendarPages || {};
  global.CoupleCalendarPages.createCalendarPage = function (ctx) {
    var $ = ctx.$, state = ctx.state, el = ctx.el, today = ctx.today;
    var ymd = ctx.ymd, parseYmd = ctx.parseYmd, cmp = ctx.cmp, buildTimeline = ctx.buildTimeline;

      function renderCalendar() {
        var grid = $("grid"); grid.textContent = "";
        var first = new Date(state.year, state.month, 1);
        var offset = (first.getDay() + 6) % 7;
        var dim = new Date(state.year, state.month + 1, 0).getDate();
        var rows = Math.ceil((offset + dim) / 7);
        $("monthLabel").textContent = first.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
        var byDate = {};
        state.events.forEach(function (e) {
          if (e.status === "declined") return;
          var s = byDate[e.date] || (byDate[e.date] = { acc: 0, pen: 0 });
          if (e.status === "accepted") s.acc++; else s.pen++;
        });
        var t = today();
        for (var i = 0; i < rows * 7; i++) {
          var d = new Date(state.year, state.month, 1 - offset + i);
          var ds = ymd(d), s = byDate[ds];
          var cls = "day" + (d.getMonth() !== state.month ? " out" : "") + (s ? " has" : "") + (ds === t ? " today" : "") + (ds === state.selected ? " sel" : "");
          var b = el("button", cls); b.type = "button";
          b.textContent = String(d.getDate());
          if (ds === state.selected) b.setAttribute("aria-pressed", "true");
          if (s) b.appendChild(el("span", "dot" + (s.acc ? "" : " hollow")));
          b.addEventListener("click", (function (dateStr) {
            return function () {
              state.selected = dateStr;
              var dd = parseYmd(dateStr); state.year = dd.getFullYear(); state.month = dd.getMonth();
              renderCalendar(); renderDayList();
            };
          })(ds));
          grid.appendChild(b);
        }
        var cur = new Date();
        $("todayBtn").hidden = (state.selected === t && state.year === cur.getFullYear() && state.month === cur.getMonth());
      }

      function renderDayList() {
        var evs = state.events.filter(function (e) { return e.date === state.selected; }).sort(cmp);
        buildTimeline($("dayList"), [{ date: state.selected, events: evs }], "Nothing scheduled for this day. Tap + to plan something!");
      }


    return { renderCalendar: renderCalendar, renderDayList: renderDayList };
  };
})(window);
