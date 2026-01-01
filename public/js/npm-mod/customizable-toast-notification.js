/*!
 * Customizable Toast Notifications 3.11.0
 * Build: 2025-11-09 16:47:48
 * Cache-Buster: 1762706868262
 * Author: Priyanshu Patel
 * Email: [priyanshu.alt191@gmail.com](mailto:priyanshu.alt191@gmail.com)
 * License: Apache-2.0
 * Dependencies: None
 * Created: July 31, 2024
 * A lightweight and fully customizable toast notification library
 * designed for seamless integration with any JavaScript or framework-based UI.
 * Supports flexible positioning, theming, icons, animations, and timing options
 * out of the box — with CTA support and zero dependencies.
 */
!(function (e, t) {
  "object" == typeof exports && "undefined" != typeof module
    ? t(exports)
    : "function" == typeof define && define.amd
    ? define(["exports"], t)
    : t(
        ((e =
          "undefined" != typeof globalThis
            ? globalThis
            : e || self).customizableToast = {})
      );
})(this, function (e) {
  "use strict";
  function t(e, t) {
    (null == t || t > e.length) && (t = e.length);
    for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
    return r;
  }
  function n(e, t, n, r, a, o, i) {
    try {
      var s = e[o](i),
        u = s.value;
    } catch (e) {
      return void n(e);
    }
    s.done ? t(u) : Promise.resolve(u).then(r, a);
  }
  function r(e) {
    return function () {
      var t = this,
        r = arguments;
      return new Promise(function (a, o) {
        var i = e.apply(t, r);
        function s(e) {
          n(i, a, o, s, u, "next", e);
        }
        function u(e) {
          n(i, a, o, s, u, "throw", e);
        }
        s(void 0);
      });
    };
  }
  function a(e, t) {
    var n =
      ("undefined" != typeof Symbol && e[Symbol.iterator]) || e["@@iterator"];
    if (!n) {
      if (Array.isArray(e) || (n = f(e)) || t) {
        n && (e = n);
        var r = 0,
          a = function () {};
        return {
          s: a,
          n: function () {
            return r >= e.length ? { done: !0 } : { done: !1, value: e[r++] };
          },
          e: function (e) {
            throw e;
          },
          f: a,
        };
      }
      throw new TypeError(
        "Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."
      );
    }
    var o,
      i = !0,
      s = !1;
    return {
      s: function () {
        n = n.call(e);
      },
      n: function () {
        var e = n.next();
        return (i = e.done), e;
      },
      e: function (e) {
        (s = !0), (o = e);
      },
      f: function () {
        try {
          i || null == n.return || n.return();
        } finally {
          if (s) throw o;
        }
      },
    };
  }
  function o(e, t, n) {
    return (
      (t = (function (e) {
        var t = (function (e, t) {
          if ("object" != typeof e || !e) return e;
          var n = e[Symbol.toPrimitive];
          if (void 0 !== n) {
            var r = n.call(e, t);
            if ("object" != typeof r) return r;
            throw new TypeError("@@toPrimitive must return a primitive value.");
          }
          return ("string" === t ? String : Number)(e);
        })(e, "string");
        return "symbol" == typeof t ? t : t + "";
      })(t)) in e
        ? Object.defineProperty(e, t, {
            value: n,
            enumerable: !0,
            configurable: !0,
            writable: !0,
          })
        : (e[t] = n),
      e
    );
  }
  function i(e, t) {
    var n = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var r = Object.getOwnPropertySymbols(e);
      t &&
        (r = r.filter(function (t) {
          return Object.getOwnPropertyDescriptor(e, t).enumerable;
        })),
        n.push.apply(n, r);
    }
    return n;
  }
  function s(e) {
    for (var t = 1; t < arguments.length; t++) {
      var n = null != arguments[t] ? arguments[t] : {};
      t % 2
        ? i(Object(n), !0).forEach(function (t) {
            o(e, t, n[t]);
          })
        : Object.getOwnPropertyDescriptors
        ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n))
        : i(Object(n)).forEach(function (t) {
            Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
          });
    }
    return e;
  }
  function u() {
    /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */
    var e,
      t,
      n = "function" == typeof Symbol ? Symbol : {},
      r = n.iterator || "@@iterator",
      a = n.toStringTag || "@@toStringTag";
    function o(n, r, a, o) {
      var u = r && r.prototype instanceof s ? r : s,
        c = Object.create(u.prototype);
      return (
        l(
          c,
          "_invoke",
          (function (n, r, a) {
            var o,
              s,
              u,
              l = 0,
              c = a || [],
              f = !1,
              d = {
                p: 0,
                n: 0,
                v: e,
                a: p,
                f: p.bind(e, 4),
                d: function (t, n) {
                  return (o = t), (s = 0), (u = e), (d.n = n), i;
                },
              };
            function p(n, r) {
              for (s = n, u = r, t = 0; !f && l && !a && t < c.length; t++) {
                var a,
                  o = c[t],
                  p = d.p,
                  h = o[2];
                n > 3
                  ? (a = h === r) &&
                    ((u = o[(s = o[4]) ? 5 : ((s = 3), 3)]), (o[4] = o[5] = e))
                  : o[0] <= p &&
                    ((a = n < 2 && p < o[1])
                      ? ((s = 0), (d.v = r), (d.n = o[1]))
                      : p < h &&
                        (a = n < 3 || o[0] > r || r > h) &&
                        ((o[4] = n), (o[5] = r), (d.n = h), (s = 0)));
              }
              if (a || n > 1) return i;
              throw ((f = !0), r);
            }
            return function (a, c, h) {
              if (l > 1) throw TypeError("Generator is already running");
              for (
                f && 1 === c && p(c, h), s = c, u = h;
                (t = s < 2 ? e : u) || !f;

              ) {
                o ||
                  (s
                    ? s < 3
                      ? (s > 1 && (d.n = -1), p(s, u))
                      : (d.n = u)
                    : (d.v = u));
                try {
                  if (((l = 2), o)) {
                    if ((s || (a = "next"), (t = o[a]))) {
                      if (!(t = t.call(o, u)))
                        throw TypeError("iterator result is not an object");
                      if (!t.done) return t;
                      (u = t.value), s < 2 && (s = 0);
                    } else
                      1 === s && (t = o.return) && t.call(o),
                        s < 2 &&
                          ((u = TypeError(
                            "The iterator does not provide a '" + a + "' method"
                          )),
                          (s = 1));
                    o = e;
                  } else if ((t = (f = d.n < 0) ? u : n.call(r, d)) !== i)
                    break;
                } catch (t) {
                  (o = e), (s = 1), (u = t);
                } finally {
                  l = 1;
                }
              }
              return { value: t, done: f };
            };
          })(n, a, o),
          !0
        ),
        c
      );
    }
    var i = {};
    function s() {}
    function c() {}
    function f() {}
    t = Object.getPrototypeOf;
    var d = [][r]
        ? t(t([][r]()))
        : (l((t = {}), r, function () {
            return this;
          }),
          t),
      p = (f.prototype = s.prototype = Object.create(d));
    function h(e) {
      return (
        Object.setPrototypeOf
          ? Object.setPrototypeOf(e, f)
          : ((e.__proto__ = f), l(e, a, "GeneratorFunction")),
        (e.prototype = Object.create(p)),
        e
      );
    }
    return (
      (c.prototype = f),
      l(p, "constructor", f),
      l(f, "constructor", c),
      (c.displayName = "GeneratorFunction"),
      l(f, a, "GeneratorFunction"),
      l(p),
      l(p, a, "Generator"),
      l(p, r, function () {
        return this;
      }),
      l(p, "toString", function () {
        return "[object Generator]";
      }),
      (u = function () {
        return { w: o, m: h };
      })()
    );
  }
  function l(e, t, n, r) {
    var a = Object.defineProperty;
    try {
      a({}, "", {});
    } catch (e) {
      a = 0;
    }
    (l = function (e, t, n, r) {
      function o(t, n) {
        l(e, t, function (e) {
          return this._invoke(t, n, e);
        });
      }
      t
        ? a
          ? a(e, t, {
              value: n,
              enumerable: !r,
              configurable: !r,
              writable: !r,
            })
          : (e[t] = n)
        : (o("next", 0), o("throw", 1), o("return", 2));
    }),
      l(e, t, n, r);
  }
  function c(e, t) {
    return (
      (function (e) {
        if (Array.isArray(e)) return e;
      })(e) ||
      (function (e, t) {
        var n =
          null == e
            ? null
            : ("undefined" != typeof Symbol && e[Symbol.iterator]) ||
              e["@@iterator"];
        if (null != n) {
          var r,
            a,
            o,
            i,
            s = [],
            u = !0,
            l = !1;
          try {
            if (((o = (n = n.call(e)).next), 0 === t)) {
              if (Object(n) !== n) return;
              u = !1;
            } else
              for (
                ;
                !(u = (r = o.call(n)).done) &&
                (s.push(r.value), s.length !== t);
                u = !0
              );
          } catch (e) {
            (l = !0), (a = e);
          } finally {
            try {
              if (!u && null != n.return && ((i = n.return()), Object(i) !== i))
                return;
            } finally {
              if (l) throw a;
            }
          }
          return s;
        }
      })(e, t) ||
      f(e, t) ||
      (function () {
        throw new TypeError(
          "Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."
        );
      })()
    );
  }
  function f(e, n) {
    if (e) {
      if ("string" == typeof e) return t(e, n);
      var r = {}.toString.call(e).slice(8, -1);
      return (
        "Object" === r && e.constructor && (r = e.constructor.name),
        "Map" === r || "Set" === r
          ? Array.from(e)
          : "Arguments" === r ||
            /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)
          ? t(e, n)
          : void 0
      );
    }
  }
  function d(e) {
    var t = Date.now().toString(36),
      n = Math.floor(1048575 * Math.random()).toString(36);
    return "".concat(e, "-").concat(t, "-").concat(n);
  }
  function p(e, t) {
    return h.apply(this, arguments);
  }
  function h() {
    return (h = r(
      u().m(function e(t, n) {
        var r;
        return u().w(function (e) {
          for (;;)
            switch (e.n) {
              case 0:
                if (t && n) {
                  e.n = 1;
                  break;
                }
                throw new Error("tagName and prefix are required");
              case 1:
                return ((r = document.createElement(t)).id = d(n)), e.a(2, r);
            }
        }, e);
      })
    )).apply(this, arguments);
  }
  function m(e) {
    return y.apply(this, arguments);
  }
  function y() {
    return (y = r(
      u().m(function e(t) {
        var n;
        return u().w(
          function (e) {
            for (;;)
              switch ((e.p = e.n)) {
                case 0:
                  if (t) {
                    e.n = 1;
                    break;
                  }
                  return e.a(2, !0);
                case 1:
                  if (
                    ((e.p = 1),
                    null == t ||
                      null === (n = t.parentNode) ||
                      void 0 === n ||
                      !n.id.includes("toast-container-"))
                  ) {
                    e.n = 2;
                    break;
                  }
                  return t.parentNode.removeChild(t), e.a(2, !0);
                case 2:
                  e.n = 4;
                  break;
                case 3:
                  (e.p = 3), e.v;
                case 4:
                  if (((e.p = 4), !t.remove)) {
                    e.n = 5;
                    break;
                  }
                  return t.remove(), e.a(2, !0);
                case 5:
                  e.n = 7;
                  break;
                case 6:
                  (e.p = 6), e.v;
                case 7:
                  return (
                    (e.p = 7),
                    Object.assign(t.style, {
                      display: "none",
                      opacity: "0",
                      pointerEvents: "none",
                      position: "absolute",
                      left: "-9999px",
                    }),
                    e.a(2, !0)
                  );
                case 8:
                  return (e.p = 8), e.v, e.a(2, !1);
              }
          },
          e,
          null,
          [
            [7, 8],
            [4, 6],
            [1, 3],
          ]
        );
      })
    )).apply(this, arguments);
  }
  function g(e) {
    return v.apply(this, arguments);
  }
  function v() {
    return (v = r(
      u().m(function e(t) {
        var n, r;
        return u().w(function (e) {
          for (;;)
            switch (e.n) {
              case 0:
                if (!("number" == typeof t && t > 0)) {
                  e.n = 1;
                  break;
                }
                return e.a(2, t);
              case 1:
                if ("string" != typeof t) {
                  e.n = 3;
                  break;
                }
                if (!t.endsWith("s") || t.endsWith("ms")) {
                  e.n = 2;
                  break;
                }
                return (n = 1e3 * parseFloat(t)), e.a(2, n > 0 ? n : 500);
              case 2:
                return (r = parseFloat(t)), e.a(2, r > 0 ? r : 500);
              case 3:
                return e.a(2, 500);
            }
        }, e);
      })
    )).apply(this, arguments);
  }
  var b = new (class {
      constructor() {
        var e =
          arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 200;
        (this.maxSize = e), (this.map = new Map());
      }
      get(e) {
        if (this.map.has(e)) {
          var t = this.map.get(e);
          return this.map.delete(e), this.map.set(e, t), t;
        }
      }
      set(e, t) {
        if (this.map.has(e)) this.map.delete(e);
        else if (this.map.size >= this.maxSize) {
          var n = this.map.keys().next().value;
          this.map.delete(n);
        }
        this.map.set(e, t);
      }
    })(200),
    w = {};
  function k(e) {
    var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 1;
    if (!e) return "snow";
    var n,
      r,
      a,
      o = "".concat(e, "|").concat(t),
      i = b.get(o);
    if (i) return i;
    if (w[null == e ? void 0 : e.toLowerCase()]) {
      var s = w[e.toLowerCase()];
      return b.set(o, s), s;
    }
    try {
      var u = null == e ? void 0 : e.match(/^#([0-9a-f]{3,8})$/i);
      if (u) {
        var l = u[1];
        3 === l.length &&
          (l = l
            .split("")
            .map((e) => e + e)
            .join("")),
          (n = parseInt(l.slice(0, 2), 16)),
          (r = parseInt(l.slice(2, 4), 16)),
          (a = parseInt(l.slice(4, 6), 16));
      } else {
        var f =
          null == e
            ? void 0
            : e.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/i);
        if (!f) throw new Error("Unknown color");
        (n = Number(f[1])), (r = Number(f[2])), (a = Number(f[3]));
      }
    } catch (e) {
      (n = 50 + Math.floor(206 * Math.random())),
        (r = 50 + Math.floor(206 * Math.random())),
        (a = 50 + Math.floor(206 * Math.random()));
    }
    (n = Math.round(n * t + 255 * (1 - t))),
      (r = Math.round(r * t + 255 * (1 - t))),
      (a = Math.round(a * t + 255 * (1 - t)));
    var d = (e, t, n) => {
        var r = [e, t, n].map((e) =>
          (e /= 255) <= 0.03928 ? e / 12.92 : Math.pow((e + 0.055) / 1.055, 2.4)
        );
        return 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2];
      },
      p = (e, t) => {
        var n = d(...e),
          r = d(...t);
        return (Math.max(n, r) + 0.05) / (Math.min(n, r) + 0.05);
      },
      h = ((e, t, n) => {
        (e /= 255), (t /= 255), (n /= 255);
        var r,
          a,
          o = Math.max(e, t, n),
          i = Math.min(e, t, n),
          s = (o + i) / 2;
        if (o === i) r = a = 0;
        else {
          var u = o - i;
          switch (((a = s > 0.5 ? u / (2 - o - i) : u / (o + i)), o)) {
            case e:
              r = (t - n) / u + (t < n ? 6 : 0);
              break;
            case t:
              r = (n - e) / u + 2;
              break;
            case n:
              r = (e - t) / u + 4;
          }
          r /= 6;
        }
        return [360 * r, a, s];
      })(n, r, a),
      m = c(h, 3),
      y = m[0],
      g = m[1],
      v = m[2],
      k = ((e, t, n) => {
        var r, a, o;
        if (((e /= 360), 0 === t)) r = a = o = n;
        else {
          var i = (e, t, n) => (
              n < 0 && (n += 1),
              n > 1 && (n -= 1),
              n < 1 / 6
                ? e + 6 * (t - e) * n
                : n < 0.5
                ? t
                : n < 2 / 3
                ? e + (t - e) * (2 / 3 - n) * 6
                : e
            ),
            s = n < 0.5 ? n * (1 + t) : n + t - n * t,
            u = 2 * n - s;
          (r = i(u, s, e + 1 / 3)), (a = i(u, s, e)), (o = i(u, s, e - 1 / 3));
        }
        return [Math.round(255 * r), Math.round(255 * a), Math.round(255 * o)];
      })(y, g, v < 0.5 ? Math.min(v + 0.5, 1) : Math.max(v - 0.5, 0)),
      x = c(k, 3),
      C = x[0],
      E = x[1],
      S = x[2];
    if (p([n, r, a], [C, E, S]) < 4.5) {
      var T = c(
        p([n, r, a], [0, 0, 0]) >= p([n, r, a], [255, 255, 255])
          ? [0, 0, 0]
          : [255, 255, 255],
        3
      );
      (C = T[0]), (E = T[1]), (S = T[2]);
    }
    var O = ((e, t, n) =>
      "#"
        .concat(e.toString(16).padStart(2, "0"))
        .concat(t.toString(16).padStart(2, "0"))
        .concat(n.toString(16).padStart(2, "0")))(C, E, S);
    return b.set(o, O), O;
  }
  function x(e) {
    if (!e || "string" != typeof e) return "";
    var t = e.replace(
      /<\/?(script|iframe|object|embed|link|meta|style|form|input|button)[^>]*>/gi,
      ""
    );
    t = (t = t.replace(/\s(on\w+)\s*=\s*(['"])[\s\S]*?\2/gi, "")).replace(
      /(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi,
      "$1=$2#$2"
    );
    var n = document.createElement("div");
    n.innerHTML = t;
    var r = new Set([
        "DIV",
        "SPAN",
        "P",
        "BR",
        "STRONG",
        "B",
        "EM",
        "I",
        "U",
        "SMALL",
        "UL",
        "OL",
        "LI",
        "A",
        "IMG",
        "PRE",
        "CODE",
        "MARK",
      ]),
      a = new Set([
        "href",
        "src",
        "alt",
        "title",
        "class",
        "style",
        "target",
        "rel",
      ]);
    function o(e) {
      if (e.nodeType === Node.TEXT_NODE)
        return document.createTextNode(e.nodeValue);
      if (e.nodeType !== Node.ELEMENT_NODE) return null;
      var t = e.tagName.toUpperCase();
      if (!r.has(t)) {
        var n = document.createDocumentFragment();
        return (
          Array.from(e.childNodes).forEach((e) => {
            var t = o(e);
            t && n.appendChild(t);
          }),
          n
        );
      }
      var i = document.createElement(e.tagName);
      return (
        Array.from(e.attributes || []).forEach((t) => {
          var n = t.name.toLowerCase(),
            r = t.value;
          a.has(n) &&
            (("href" !== n && "src" !== n) || !/^\s*javascript:/i.test(r)) &&
            ("src" !== n || /^\s*(https?:|data:image\/)/i.test(r)) &&
            ("target" === n &&
              "_blank" === r &&
              i.setAttribute(
                "rel",
                (e.getAttribute("rel") || "") + " noopener noreferrer"
              ),
            i.setAttribute(n, r));
        }),
        Array.from(e.childNodes).forEach((e) => {
          var t = o(e);
          t && i.appendChild(t);
        }),
        i
      );
    }
    var i = document.createDocumentFragment();
    Array.from(n.childNodes).forEach((e) => {
      var t = o(e);
      t && i.appendChild(t);
    });
    var s = document.createElement("div");
    return s.appendChild(i), s.innerHTML;
  }
  function C(e) {
    var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
    if (!e) return "";
    try {
      if (
        !t.forceFallback &&
        (function () {
          try {
            if ("undefined" != typeof window && window.DOMPurify) return !0;
          } catch (e) {}
          return !1;
        })()
      )
        return window.DOMPurify.sanitize(e, {
          ADD_ATTR: ["target"],
          ALLOWED_URI_REGEXP:
            /^(?:(?:https?|mailto|ftp|tel|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        });
    } catch (e) {}
    return x(e);
  }
  function E() {
    var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
      t = e.size || 14,
      n = e.color || "currentColor",
      r = e.text || "",
      a = document.createElement("span");
    (a.className = "toast-loader"),
      (a.style.display = "inline-flex"),
      (a.style.alignItems = "center"),
      (a.style.gap = "8px");
    var o = "http://www.w3.org/2000/svg",
      i = document.createElementNS(o, "svg");
    i.setAttribute("width", String(t)),
      i.setAttribute("height", String(t)),
      i.setAttribute("viewBox", "0 0 50 50"),
      i.setAttribute("aria-hidden", "true");
    var s = document.createElementNS(o, "circle");
    if (
      (s.setAttribute("cx", "25"),
      s.setAttribute("cy", "25"),
      s.setAttribute("r", "20"),
      s.setAttribute("fill", "none"),
      s.setAttribute("stroke", n),
      s.setAttribute("stroke-width", "4"),
      s.setAttribute("stroke-linecap", "round"),
      (s.style.opacity = "0.85"),
      (s.style.strokeDasharray = "90"),
      (s.style.strokeDashoffset = "60"),
      (s.style.transformOrigin = "center"),
      (s.style.animation = "toast-spinner 1s linear infinite"),
      i.appendChild(s),
      a.appendChild(i),
      r)
    ) {
      var u = document.createElement("span");
      (u.style.fontSize = "13px"), (u.textContent = r), a.appendChild(u);
    }
    if (!document.getElementById("toast-spinner-styles")) {
      var l = document.createElement("style");
      (l.id = "toast-spinner-styles"),
        (l.innerHTML =
          "@keyframes toast-spinner { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }"),
        document.head.appendChild(l);
    }
    return a;
  }
  function S(e, t, n) {
    var a = null == t ? void 0 : t.cta;
    if (a) {
      a.label || (a.label = "CTA Label Missing!");
      var o = !!a.href && "link" === a.variant,
        i = document.createElement(o ? "a" : "button");
      o
        ? ((i.href = a.href),
          a.target && (i.target = a.target),
          (i.rel =
            a.rel || ("_blank" === a.target ? "noopener noreferrer" : "")))
        : (i.type = "button"),
        i.setAttribute("aria-label", a.ariaLabel || a.label),
        Object.assign(i.style, {
          marginLeft: "10px",
          padding: "6px 10px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "600",
          lineHeight: "1",
          border: "1px solid rgba(255,255,255,0.35)",
          color: t.textColor || "#fff",
          background: "rgba(255,255,255,0.15)",
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: "0",
        }),
        (i.textContent = a.label);
      var s = (function () {
        var t = r(
          u().m(function t(r) {
            var o;
            return u().w(
              function (t) {
                for (;;)
                  switch ((t.p = t.n)) {
                    case 0:
                      if (((t.p = 0), "function" != typeof a.onClick)) {
                        t.n = 1;
                        break;
                      }
                      if (null == (o = a.onClick(r)) || !o.then) {
                        t.n = 1;
                        break;
                      }
                      return (t.n = 1), o;
                    case 1:
                      return (t.p = 1), !1 !== a.autoClose && n(e), t.f(1);
                    case 2:
                      return t.a(2);
                  }
              },
              t,
              null,
              [[0, , 1, 2]]
            );
          })
        );
        return function (e) {
          return t.apply(this, arguments);
        };
      })();
      i.addEventListener("click", s),
        (i._cleanup = () => i.removeEventListener("click", s)),
        e.appendChild(i);
    }
  }
  function T(e, t, n) {
    var r = document.createElement("button");
    r.setAttribute("aria-label", "Close notification"),
      r.setAttribute("title", "Close"),
      (r.textContent = "×"),
      Object.assign(r.style, {
        background: "none",
        border: "none",
        color: t.textColor || "white",
        fontSize: "18px",
        marginLeft: "10px",
        cursor: "pointer",
      });
    var a = () => n(e);
    r.addEventListener("click", a),
      (e._cleanupCloseButton = () => {
        r.removeEventListener("click", a);
      }),
      e.appendChild(r);
  }
  function O(e, t) {
    var n = document.createElement("div"),
      r = t.borderRadius || 0,
      a = parseInt(r, 10),
      o = a ? "calc(100% - ".concat(a - 10 + "px", ")") : "100%",
      i = a ? "12px" : "0";
    Object.assign(n.style, {
      position: "absolute",
      left: "".concat(i),
      height: t.progressHeight || "4px",
      background: t.progressColor || "rgba(255, 255, 255, 0.3)",
      width: "".concat(o),
      transition: "width ".concat(t.duration || 1800, "ms linear"),
      ["top" === t.progressPosition ? "top" : "bottom"]: "0",
      borderRadius: t.borderRadius || "4px",
    }),
      e.appendChild(n),
      setTimeout(() => {
        n.offsetWidth, (n.style.width = "0%");
      }, 50);
  }
  function A(e) {
    setTimeout(() => {
      requestAnimationFrame(() => {
        (e.style.opacity = "1"), (e.style.transform = "translateY(0)");
      });
    }, 50);
  }
  function j(e, t, n) {
    return L.apply(this, arguments);
  }
  function L() {
    return (L = r(
      u().m(function e(t, n, r) {
        var a, o, i, s, l, c, f, d, p, h;
        return u().w(function (e) {
          for (;;)
            switch (e.n) {
              case 0:
                return (e.n = 1), g(null == n ? void 0 : n.animationDuration);
              case 1:
                if (
                  ((i = e.v),
                  (t.className = "toast toast-".concat(
                    null !== (a = null == n ? void 0 : n.type) && void 0 !== a
                      ? a
                      : "info"
                  )),
                  Object.assign(t.style, {
                    background: null == n ? void 0 : n.backgroundColor,
                    padding: "12px 16px",
                    marginBottom: "10px",
                    borderRadius: null == n ? void 0 : n.borderRadius,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                    minWidth: "250px",
                    maxWidth: null == n ? void 0 : n.maxWidth,
                    opacity: "0",
                    position: "relative",
                    cursor: "default",
                    boxSizing: "border-box",
                    userSelect: "text",
                    transition: "opacity "
                      .concat(null == n ? void 0 : n.animationDuration, " ")
                      .concat(
                        null == n ? void 0 : n.animationEasing,
                        ", transform "
                      )
                      .concat(null == n ? void 0 : n.animationDuration, " ")
                      .concat(null == n ? void 0 : n.animationEasing),
                    transform: "translateY(20px)",
                    zIndex: "9999",
                  }),
                  t.setAttribute("role", "alert"),
                  t.setAttribute("aria-live", "polite"),
                  (t.tabIndex = 0),
                  (t._animationDuration = i),
                  (s = document.createElement("span")),
                  null != n && n.wrapText
                    ? Object.assign(s.style, {
                        display: "block",
                        whiteSpace: "normal",
                      })
                    : Object.assign(s.style, {
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: "3",
                        whiteSpace: "nowrap",
                      }),
                  Object.assign(s.style, {
                    flex: "1",
                    padding: null == n ? void 0 : n.fontPadding,
                    fontFamily: null == n ? void 0 : n.fontFamily,
                    fontSize: null == n ? void 0 : n.fontSize,
                    fontWeight: null == n ? void 0 : n.fontWeight,
                    lineHeight: null == n ? void 0 : n.fontLineHeight,
                    color: null == n ? void 0 : n.textColor,
                    userSelect: "text",
                    wordBreak: "break-word",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: "3",
                    WebkitBoxOrient: "vertical",
                  }),
                  (l = !!n.allowHtml),
                  (c = null !== (o = n.message) && void 0 !== o ? o : ""),
                  (n.loader || n.showLoader) &&
                    ((f = E(n.loader || {})),
                    s.appendChild(f),
                    ((d = document.createElement("span")).style.display =
                      "inline-block"),
                    (d.style.width = "8px"),
                    s.appendChild(d)),
                  l && "string" == typeof c && c.trim().length > 0)
                )
                  try {
                    for (
                      p = C(c),
                        (h = document.createElement("div")).innerHTML = p;
                      h.firstChild;

                    )
                      s.appendChild(h.firstChild);
                  } catch (e) {
                    s.textContent = c;
                  }
                else s.textContent = String(c);
                s.setAttribute("aria-label", "Toast Notification Center"),
                  s.setAttribute(
                    "title",
                    "string" == typeof c ? c.replace(/<[^>]+>/g, "") : String(c)
                  ),
                  t.appendChild(s),
                  null != n &&
                    n.cta &&
                    0 !== Object.keys(n.cta).length &&
                    S(t, n, r),
                  null != n && n.showCloseButton && T(t, n, r),
                  null != n && n.showProgressBar && O(t, n),
                  A(t);
              case 2:
                return e.a(2);
            }
        }, e);
      })
    )).apply(this, arguments);
  }
  function M(e, t) {
    return I.apply(this, arguments);
  }
  function I() {
    return (I = r(
      u().m(function e(t, n) {
        var r, a, o, i;
        return u().w(
          function (e) {
            for (;;)
              switch ((e.p = e.n)) {
                case 0:
                  for (
                    e.p = 0,
                      r = document.createElement("div"),
                      Object.assign(r.style, {
                        background: "#333",
                        color: "white",
                        padding: "10px 15px",
                        position: "fixed",
                        top: "20px",
                        right: "20px",
                        zIndex: "99999",
                        borderRadius: "3px",
                        maxWidth: "250px",
                        wordWrap: "break-word",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
                        cursor: "pointer",
                      }),
                      a = document.createElement("div"),
                      (o = document.createElement("span")).style.display =
                        "inline-block",
                      t.allowHtml
                        ? (o.innerHTML = C(
                            String(t.message || "Emergency Toast Showing!")
                          ))
                        : (o.textContent = String(
                            t.message || "Emergency Toast Creation Showing!"
                          )),
                      a.appendChild(o),
                      (i = document.createElement("span")).style.cssText =
                        "float: right; margin-left: 10px; font-weight: bold;",
                      i.textContent = "×",
                      a.appendChild(i);
                    r.firstChild;

                  )
                    r.removeChild(r.firstChild);
                  return (
                    r.appendChild(a),
                    (i.onclick = () => {
                      r.remove(), n(r);
                    }),
                    document.body.appendChild(r),
                    setTimeout(
                      () => {
                        r.remove(), n(r);
                      },
                      null == t ? void 0 : t.duration
                    ),
                    e.a(2, r)
                  );
                case 1:
                  return (
                    (e.p = 1),
                    e.v,
                    setTimeout(() => {
                      alert(
                        (null == t ? void 0 : t.message) ||
                          "Emergency Toast Creation Showing!"
                      ),
                        n(null);
                    }, 100),
                    e.a(2, null)
                  );
              }
          },
          e,
          null,
          [[0, 1]]
        );
      })
    )).apply(this, arguments);
  }
  function P(e, t) {
    return D.apply(this, arguments);
  }
  function D() {
    return (D = r(
      u().m(function e(t, n) {
        var r;
        return u().w(
          function (e) {
            for (;;)
              switch ((e.p = e.n)) {
                case 0:
                  if (document.querySelector('[id^="toast-container-"]')) {
                    e.n = 1;
                    break;
                  }
                  return e.a(2, null);
                case 1:
                  return (e.p = 2), (e.n = 3), p("div", "toast");
                case 3:
                  return (r = e.v), (e.n = 4), j(r, t, n);
                case 4:
                  return e.a(2, r);
                case 5:
                  return (e.p = 5), e.v, (e.n = 6), M(t, n);
                case 6:
                  return (r = e.v), e.a(2, r);
              }
          },
          e,
          null,
          [[2, 5]]
        );
      })
    )).apply(this, arguments);
  }
  Object.entries({
    aliceblue: [240, 248, 255],
    antiquewhite: [250, 235, 215],
    aqua: [0, 255, 255],
    aquamarine: [127, 255, 212],
    azure: [240, 255, 255],
    beige: [245, 245, 220],
    bisque: [255, 228, 196],
    black: [0, 0, 0],
    blanchedalmond: [255, 235, 205],
    blue: [0, 0, 255],
    blueviolet: [138, 43, 226],
    brown: [165, 42, 42],
    burlywood: [222, 184, 135],
    cadetblue: [95, 158, 160],
    chartreuse: [127, 255, 0],
    chocolate: [210, 105, 30],
    coral: [255, 127, 80],
    cornflowerblue: [100, 149, 237],
    cornsilk: [255, 248, 220],
    crimson: [220, 20, 60],
    cyan: [0, 255, 255],
    darkblue: [0, 0, 139],
    darkcyan: [0, 139, 139],
    darkgoldenrod: [184, 134, 11],
    darkgray: [169, 169, 169],
    darkgreen: [0, 100, 0],
    darkgrey: [169, 169, 169],
    darkkhaki: [189, 183, 107],
    darkmagenta: [139, 0, 139],
    darkolivegreen: [85, 107, 47],
    darkorange: [255, 140, 0],
    darkorchid: [153, 50, 204],
    darkred: [139, 0, 0],
    darksalmon: [233, 150, 122],
    darkseagreen: [143, 188, 143],
    darkslateblue: [72, 61, 139],
    darkslategray: [47, 79, 79],
    darkslategrey: [47, 79, 79],
    darkturquoise: [0, 206, 209],
    darkviolet: [148, 0, 211],
    deeppink: [255, 20, 147],
    deepskyblue: [0, 191, 255],
    dimgray: [105, 105, 105],
    dimgrey: [105, 105, 105],
    dodgerblue: [30, 144, 255],
    firebrick: [178, 34, 34],
    floralwhite: [255, 250, 240],
    forestgreen: [34, 139, 34],
    fuchsia: [255, 0, 255],
    gainsboro: [220, 220, 220],
    ghostwhite: [248, 248, 255],
    gold: [255, 215, 0],
    goldenrod: [218, 165, 32],
    gray: [128, 128, 128],
    green: [0, 128, 0],
    greenyellow: [173, 255, 47],
    grey: [128, 128, 128],
    honeydew: [240, 255, 240],
    hotpink: [255, 105, 180],
    indianred: [205, 92, 92],
    indigo: [75, 0, 130],
    ivory: [255, 255, 240],
    khaki: [240, 230, 140],
    lavender: [230, 230, 250],
    lavenderblush: [255, 240, 245],
    lawngreen: [124, 252, 0],
    lemonchiffon: [255, 250, 205],
    lightblue: [173, 216, 230],
    lightcoral: [240, 128, 128],
    lightcyan: [224, 255, 255],
    lightgoldenrodyellow: [250, 250, 210],
    lightgray: [211, 211, 211],
    lightgreen: [144, 238, 144],
    lightgrey: [211, 211, 211],
    lightpink: [255, 182, 193],
    lightsalmon: [255, 160, 122],
    lightseagreen: [32, 178, 170],
    lightskyblue: [135, 206, 250],
    lightslategray: [119, 136, 153],
    lightslategrey: [119, 136, 153],
    lightsteelblue: [176, 196, 222],
    lightyellow: [255, 255, 224],
    lime: [0, 255, 0],
    limegreen: [50, 205, 50],
    linen: [250, 240, 230],
    magenta: [255, 0, 255],
    maroon: [128, 0, 0],
    mediumaquamarine: [102, 205, 170],
    mediumblue: [0, 0, 205],
    mediumorchid: [186, 85, 211],
    mediumpurple: [147, 112, 219],
    mediumseagreen: [60, 179, 113],
    mediumslateblue: [123, 104, 238],
    mediumspringgreen: [0, 250, 154],
    mediumturquoise: [72, 209, 204],
    mediumvioletred: [199, 21, 133],
    midnightblue: [25, 25, 112],
    mintcream: [245, 255, 250],
    mistyrose: [255, 228, 225],
    moccasin: [255, 228, 181],
    navajowhite: [255, 222, 173],
    navy: [0, 0, 128],
    oldlace: [253, 245, 230],
    olive: [128, 128, 0],
    olivedrab: [107, 142, 35],
    orange: [255, 165, 0],
    orangered: [255, 69, 0],
    orchid: [218, 112, 214],
    palegoldenrod: [238, 232, 170],
    palegreen: [152, 251, 152],
    paleturquoise: [175, 238, 238],
    palevioletred: [219, 112, 147],
    papayawhip: [255, 239, 213],
    peachpuff: [255, 218, 185],
    peru: [205, 133, 63],
    pink: [255, 192, 203],
    plum: [221, 160, 221],
    powderblue: [176, 224, 230],
    purple: [128, 0, 128],
    rebeccapurple: [102, 51, 153],
    red: [255, 0, 0],
    rosybrown: [188, 143, 143],
    royalblue: [65, 105, 225],
    saddlebrown: [139, 69, 19],
    salmon: [250, 128, 114],
    sandybrown: [244, 164, 96],
    seagreen: [46, 139, 87],
    seashell: [255, 245, 238],
    sienna: [160, 82, 45],
    silver: [192, 192, 192],
    skyblue: [135, 206, 235],
    slateblue: [106, 90, 205],
    slategray: [112, 128, 144],
    slategrey: [112, 128, 144],
    snow: [255, 250, 250],
    springgreen: [0, 255, 127],
    steelblue: [70, 130, 180],
    tan: [210, 180, 140],
    teal: [0, 128, 128],
    thistle: [216, 191, 216],
    tomato: [255, 99, 71],
    turquoise: [64, 224, 208],
    violet: [238, 130, 238],
    wheat: [245, 222, 179],
    white: [255, 255, 255],
    whitesmoke: [245, 245, 245],
    yellow: [255, 255, 0],
    yellowgreen: [154, 205, 50],
  }).forEach((e) => {
    var t = c(e, 2),
      n = t[0],
      r = c(t[1], 3),
      a = r[0],
      o = r[1],
      i = r[2],
      s = (e) => {
        var t = e / 255;
        return t <= 0.03928 ? t / 12.92 : Math.pow((t + 0.055) / 1.055, 2.4);
      },
      u = 0.2126 * s(a) + 0.7152 * s(o) + 0.0722 * s(i),
      l = (u + 0.05) / 0.05,
      f = 1.05 / (u + 0.05);
    w[n.toLowerCase()] = l >= f ? "#000000" : "#ffffff";
  });
  var z = new Map(),
    N = new Map();
  function B(e) {
    return "toast-container-".concat(
      (function (e) {
        return String(e)
          .toLowerCase()
          .trim()
          .replace(/\bbelow\b/g, "bottom")
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-{2,}/g, "-");
      })(e)
    );
  }
  function R(e, t) {
    return W.apply(this, arguments);
  }
  function W() {
    return (
      (W = r(
        u().m(function e(t, n) {
          var a, o, i;
          return u().w(
            function (e) {
              for (;;)
                switch ((e.p = e.n)) {
                  case 0:
                    if (((a = B(t.position)), !N.has(a))) {
                      e.n = 1;
                      break;
                    }
                    return e.a(2, N.get(a));
                  case 1:
                    return (
                      (o = r(
                        u().m(function e() {
                          var r, o, i, s;
                          return u().w(function (e) {
                            for (;;)
                              switch (e.n) {
                                case 0:
                                  if (
                                    null == (r = z.get(a)) ||
                                    !r.isConnected
                                  ) {
                                    e.n = 1;
                                    break;
                                  }
                                  return e.a(2, r);
                                case 1:
                                  if (
                                    ((o = document.getElementById(a)) &&
                                      !o.isConnected &&
                                      document.body.appendChild(o),
                                    o)
                                  ) {
                                    e.n = 3;
                                    break;
                                  }
                                  if (
                                    (((o = document.createElement("div")).id =
                                      a),
                                    o.setAttribute("role", "status"),
                                    o.setAttribute("aria-atomic", "true"),
                                    (o.style.position = "fixed"),
                                    (o.style.zIndex = "9999"),
                                    (o.style.inset = "auto 10px 10px auto"),
                                    (o.style.display = "flex"),
                                    (o.style.justifyContent = "space-between"),
                                    (o.style.alignItems = "center"),
                                    (o.style.flexDirection = "column"),
                                    (o.style.overflow = "hidden"),
                                    "function" != typeof n)
                                  ) {
                                    e.n = 2;
                                    break;
                                  }
                                  return (e.n = 2), n(o, t);
                                case 2:
                                  document.body.appendChild(o), (e.n = 4);
                                  break;
                                case 3:
                                  if (
                                    ((o.style.position =
                                      o.style.position || "fixed"),
                                    (o.style.zIndex = o.style.zIndex || "9999"),
                                    "function" != typeof n)
                                  ) {
                                    e.n = 4;
                                    break;
                                  }
                                  return (e.n = 4), n(o, t);
                                case 4:
                                  if (
                                    (i = document.querySelectorAll(
                                      "#".concat(a)
                                    )).length > 1
                                  )
                                    for (s = 1; s < i.length; s++)
                                      try {
                                        i[s].remove();
                                      } catch (e) {}
                                  return z.set(a, o), e.a(2, o);
                              }
                          }, e);
                        })
                      )()),
                      N.set(a, o),
                      (e.p = 2),
                      (e.n = 3),
                      o
                    );
                  case 3:
                    return (i = e.v), e.a(2, i);
                  case 4:
                    return (e.p = 4), N.delete(B(t.position)), e.f(4);
                  case 5:
                    return e.a(2);
                }
            },
            e,
            null,
            [[2, , 4, 5]]
          );
        })
      )),
      W.apply(this, arguments)
    );
  }
  function H(e, t) {
    return _.apply(this, arguments);
  }
  function _() {
    return (_ = r(
      u().m(function e(t, n) {
        var r;
        return u().w(function (e) {
          for (;;)
            switch (e.n) {
              case 0:
                if (t && n.position) {
                  e.n = 1;
                  break;
                }
                throw new Error("Invalid container or position!");
              case 1:
                if ((q(t), (r = F(n.position)), !G(t, n, r))) {
                  e.n = 2;
                  break;
                }
                return e.a(2);
              case 2:
                if (!U(t, r)) {
                  e.n = 3;
                  break;
                }
                return e.a(2);
              case 3:
                $(t, r);
              case 4:
                return e.a(2);
            }
        }, e);
      })
    )).apply(this, arguments);
  }
  function q(e) {
    (e.style.top = "auto"),
      (e.style.bottom = "auto"),
      (e.style.left = "auto"),
      (e.style.right = "auto"),
      (e.style.transform = "none");
  }
  function F(e) {
    var t = e.toLowerCase().trim();
    return {
      hasTop: t.includes("top"),
      hasBottom: t.includes("bottom") || t.includes("below"),
      hasLeft: t.includes("left"),
      hasRight: t.includes("right"),
      hasCenter: t.includes("center"),
      hasFullWidth:
        t.includes("top-full-width") ||
        t.includes("bottom-full-width") ||
        t.includes("fullwidth"),
    };
  }
  function G(e, t, n) {
    return (
      !!n.hasFullWidth &&
      ((t.maxWidth = "100vw"),
      n.hasTop
        ? ((e.style.top = "10px"),
          (e.style.left = "10px"),
          (e.style.right = "10px"),
          !0)
        : !!n.hasBottom &&
          ((e.style.bottom = "10px"),
          (e.style.left = "10px"),
          (e.style.right = "10px"),
          !0))
    );
  }
  function U(e, t) {
    return (
      !!t.hasCenter &&
      (!t.hasTop || t.hasLeft || t.hasRight
        ? !t.hasBottom || t.hasLeft || t.hasRight
          ? !t.hasLeft || t.hasTop || t.hasBottom
            ? !t.hasRight || t.hasTop || t.hasBottom
              ? !(t.hasLeft || t.hasRight || t.hasTop || t.hasBottom) &&
                ((e.style.top = "50%"),
                (e.style.left = "50%"),
                (e.style.transform = "translate(-50%, -50%)"),
                !0)
              : ((e.style.right = "10px"),
                (e.style.top = "50%"),
                (e.style.transform = "translateY(-50%)"),
                !0)
            : ((e.style.left = "10px"),
              (e.style.top = "50%"),
              (e.style.transform = "translateY(-50%)"),
              !0)
          : ((e.style.bottom = "10px"),
            (e.style.left = "50%"),
            (e.style.transform = "translateX(-50%)"),
            !0)
        : ((e.style.top = "10px"),
          (e.style.left = "50%"),
          (e.style.transform = "translateX(-50%)"),
          !0))
    );
  }
  function $(e, t) {
    t.hasBottom
      ? (e.style.bottom = "10px")
      : t.hasTop && (e.style.top = "10px"),
      t.hasRight
        ? (e.style.right = "10px")
        : t.hasLeft
        ? (e.style.left = "10px")
        : ((e.style.bottom = "10px"),
          (e.style.left = "50%"),
          (e.style.transform = "translateX(-50%)"));
  }
  class X {
    constructor(e, t) {
      (this.callback = e),
        (this.delay = t),
        (this.remaining = t),
        (this.startTime = null),
        (this.timeoutId = null),
        (this.isPaused = !1),
        (this.isCompleted = !1);
    }
    start() {
      return (
        this.isCompleted ||
          this.timeoutId ||
          ((this.startTime = Date.now()),
          (this.timeoutId = setTimeout(() => {
            (this.isCompleted = !0), (this.timeoutId = null), this.callback();
          }, this.remaining))),
        this
      );
    }
    pause() {
      return (
        this.isPaused ||
          !this.timeoutId ||
          this.isCompleted ||
          (clearTimeout(this.timeoutId),
          (this.timeoutId = null),
          (this.remaining -= Date.now() - this.startTime),
          (this.remaining = Math.max(0, this.remaining)),
          (this.isPaused = !0)),
        this
      );
    }
    resume() {
      return (
        !this.isPaused ||
          this.isCompleted ||
          ((this.isPaused = !1), this.start()),
        this
      );
    }
    clear() {
      return (
        this.timeoutId &&
          (clearTimeout(this.timeoutId), (this.timeoutId = null)),
        (this.isCompleted = !0),
        this
      );
    }
    getRemainingTime() {
      return this.isCompleted
        ? 0
        : this.isPaused
        ? this.remaining
        : this.timeoutId
        ? Math.max(0, this.remaining - (Date.now() - this.startTime))
        : this.delay;
    }
  }
  var Y = new Map(),
    V = new Map(),
    K = [],
    J = 0;
  function Q() {
    var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
      t = String(e.type).trim().toLowerCase(),
      n = (function (e) {
        for (var t = 5381, n = 0; n < e.length; n++)
          t = (t << 5) + t + e.charCodeAt(n);
        return t >>> 0;
      })(String(e.message || "")).toString(16),
      r = String(e.position).trim().toLowerCase();
    return "".concat(t, "|").concat(n, "|").concat(r);
  }
  function Z() {
    return ee.apply(this, arguments);
  }
  function ee() {
    return (
      (ee = r(
        u().m(function e() {
          var t,
            n,
            a,
            o,
            i,
            s = arguments;
          return u().w(
            function (e) {
              for (;;)
                switch ((e.p = e.n)) {
                  case 0:
                    if (
                      ((t = s.length > 0 && void 0 !== s[0] ? s[0] : {}),
                      (e.p = 1),
                      (n = Q(t)),
                      !Y.has(n))
                    ) {
                      e.n = 5;
                      break;
                    }
                    if ((a = Y.get(n))) {
                      e.n = 2;
                      break;
                    }
                    throw new Error(
                      "Active toast with key ".concat(n, " not found")
                    );
                  case 2:
                    return (
                      a.count++,
                      a.timer.clear(),
                      (a.timer = se(a.toast, t)),
                      (e.n = 3),
                      ue(a)
                    );
                  case 3:
                    return (e.n = 4), ye(a);
                  case 4:
                    return e.a(2);
                  case 5:
                    if (!V.has(n)) {
                      e.n = 7;
                      break;
                    }
                    if ((o = V.get(n))) {
                      e.n = 6;
                      break;
                    }
                    throw new Error(
                      "Pending toast with key ".concat(n, " not found")
                    );
                  case 6:
                    return o.count++, e.a(2);
                  case 7:
                    (i = { options: t, count: 1, rafId: 0 }),
                      V.set(n, i),
                      (i.rafId = requestAnimationFrame(
                        r(
                          u().m(function e() {
                            var t;
                            return u().w(
                              function (e) {
                                for (;;)
                                  switch ((e.p = e.n)) {
                                    case 0:
                                      if ((t = V.get(n))) {
                                        e.n = 1;
                                        break;
                                      }
                                      return e.a(2);
                                    case 1:
                                      if ((V.delete(n), !(J >= 3))) {
                                        e.n = 3;
                                        break;
                                      }
                                      return (
                                        K.push({
                                          options: t.options,
                                          key: n,
                                          count: t.count,
                                        }),
                                        (e.n = 2),
                                        de()
                                      );
                                    case 2:
                                      return e.a(2);
                                    case 3:
                                      return (
                                        (e.p = 3),
                                        (e.n = 4),
                                        te(t.options, n, t.count)
                                      );
                                    case 4:
                                      e.n = 6;
                                      break;
                                    case 5:
                                      (e.p = 5), e.v;
                                    case 6:
                                      return e.a(2);
                                  }
                              },
                              e,
                              null,
                              [[3, 5]]
                            );
                          })
                        )
                      )),
                      (e.n = 9);
                    break;
                  case 8:
                    (e.p = 8), e.v;
                  case 9:
                    return e.a(2);
                }
            },
            e,
            null,
            [[1, 8]]
          );
        })
      )),
      ee.apply(this, arguments)
    );
  }
  function te(e, t, n) {
    return ne.apply(this, arguments);
  }
  function ne() {
    return (ne = r(
      u().m(function e(t, n, r) {
        var a, o, i, s, l, c, f, d;
        return u().w(
          function (e) {
            for (;;)
              switch ((e.p = e.n)) {
                case 0:
                  if (((e.p = 0), t && "object" == typeof t)) {
                    e.n = 1;
                    break;
                  }
                  throw new TypeError("options must be an object");
                case 1:
                  return J++, (e.n = 2), R(t, H);
                case 2:
                  if ((a = e.v)) {
                    e.n = 3;
                    break;
                  }
                  throw new Error("Failed to create toast container");
                case 3:
                  return (e.n = 4), P(t, ce);
                case 4:
                  if ((o = e.v)) {
                    e.n = 5;
                    break;
                  }
                  throw new Error("Toast element creation failed");
                case 5:
                  if (
                    ((i = document.createElement("div")),
                    Object.assign(i.style, {
                      position: "relative",
                      display: "inline-block",
                      overflow: "visible",
                      marginBottom: "10px",
                      zIndex: "0",
                      width: "100%",
                    }),
                    (s = document.createElement("div")),
                    Object.assign(s.style, {
                      position: "relative",
                      overflow: "hidden",
                      zIndex: "1",
                    }),
                    s.appendChild(o),
                    i.appendChild(s),
                    a.id.includes("toast-container-") && a.appendChild(i),
                    (l =
                      !1 !== t.pauseOnHover &&
                      (!0 === t.pauseOnHover || !!t.cta)),
                    (c = {
                      outer: i,
                      toast: o,
                      count: Math.max(1, Math.floor(null != r ? r : 0)),
                      timeout: null,
                      pauseOnHover: l,
                    }),
                    Y.set(n, c),
                    (o._key = n),
                    !(c.count > 1))
                  ) {
                    e.n = 6;
                    break;
                  }
                  return (e.n = 6), ye(c);
                case 6:
                  return (c.timer = se(o, t)), (e.n = 7), ue(c);
                case 7:
                  e.n = 10;
                  break;
                case 8:
                  return (
                    (e.p = 8),
                    e.v,
                    (J = Math.max(0, J - 1)),
                    (f =
                      document.querySelector('[id^="toast-container-"]') ||
                      document.body),
                    (d = f),
                    (e.n = 9),
                    M(t, ce)
                  );
                case 9:
                  d.appendChild.call(d, e.v);
                case 10:
                  return e.a(2);
              }
          },
          e,
          null,
          [[0, 8]]
        );
      })
    )).apply(this, arguments);
  }
  function re() {
    return (re = r(
      u().m(function e() {
        var t, n, r, a, o, i;
        return u().w(
          function (e) {
            for (;;)
              switch ((e.p = e.n)) {
                case 0:
                  if (((e.p = 0), 0 !== Y.size)) {
                    e.n = 1;
                    break;
                  }
                  return e.a(2);
                case 1:
                  if (
                    ((t = null),
                    document
                      .querySelectorAll('[id^="toast-container-"]')
                      .forEach((e) => {
                        var n = Array.from(e.children || []);
                        if (0 !== n.length) {
                          var r = n.at(0);
                          r && (t = r.querySelector('[id^="toast-"]') || r);
                        }
                      }),
                    t ||
                      ((n = Array.from(Y.entries())).length > 0 &&
                        ((r = n.at(0)),
                        (a = c(r, 2)),
                        (o = a[1]),
                        (t =
                          o.toast ||
                          (o.outer &&
                            o.outer.querySelector('[id^="toast-"]'))))),
                    t)
                  ) {
                    e.n = 2;
                    break;
                  }
                  return e.a(2);
                case 2:
                  return (
                    (i = t._key ? t : t.querySelector('[id^="toast-"]') || t),
                    (e.n = 3),
                    ce(i)
                  );
                case 3:
                  e.n = 5;
                  break;
                case 4:
                  (e.p = 4), e.v;
                case 5:
                  return e.a(2);
              }
          },
          e,
          null,
          [[0, 4]]
        );
      })
    )).apply(this, arguments);
  }
  function ae() {
    return (ae = r(
      u().m(function e() {
        var t, n, r, o, i;
        return u().w(
          function (e) {
            for (;;)
              switch ((e.p = e.n)) {
                case 0:
                  (e.p = 0),
                    (t = Array.from(Y.values())
                      .map((e) => e.toast)
                      .filter(Boolean)),
                    (K.length = 0),
                    V.clear(),
                    (n = a(t)),
                    (e.p = 1),
                    n.s();
                case 2:
                  if ((r = n.n()).done) {
                    e.n = 7;
                    break;
                  }
                  return (o = r.value), (e.p = 3), (e.n = 4), ce(o);
                case 4:
                  e.n = 6;
                  break;
                case 5:
                  (e.p = 5), e.v;
                case 6:
                  e.n = 2;
                  break;
                case 7:
                  e.n = 9;
                  break;
                case 8:
                  (e.p = 8), (i = e.v), n.e(i);
                case 9:
                  return (e.p = 9), n.f(), e.f(9);
                case 10:
                  e.n = 12;
                  break;
                case 11:
                  (e.p = 11), e.v;
                case 12:
                  return e.a(2);
              }
          },
          e,
          null,
          [
            [3, 5],
            [1, 8, 9, 10],
            [0, 11],
          ]
        );
      })
    )).apply(this, arguments);
  }
  var oe = function () {
      return re.apply(this, arguments);
    },
    ie = function () {
      return ae.apply(this, arguments);
    };
  function se(e, t) {
    var n,
      a = Number(null !== (n = t.duration) && void 0 !== n ? n : 1800) + 5,
      o = new X(
        r(
          u().m(function t() {
            return u().w(function (t) {
              for (;;)
                switch (t.n) {
                  case 0:
                    return (t.n = 1), ce(e);
                  case 1:
                    return t.a(2, t.v);
                }
            }, t);
          })
        ),
        a
      );
    return o.start(), o;
  }
  function ue(e) {
    return le.apply(this, arguments);
  }
  function le() {
    return (le = r(
      u().m(function e(t) {
        var n, r, a, o, i, s;
        return u().w(function (e) {
          for (;;)
            switch (e.n) {
              case 0:
                if (t.pauseOnHover && t.outer && t.timer) {
                  e.n = 1;
                  break;
                }
                return e.a(2);
              case 1:
                (n = t.outer),
                  (r = t.timer),
                  (a = () => r.pause()),
                  (o = () => r.resume()),
                  (i = (e) => {
                    e.target.matches("[tabindex], div, span, button, a") &&
                      r.pause();
                  }),
                  (s = (e) => {
                    n.contains(e.relatedTarget) || r.resume();
                  }),
                  n.addEventListener("mouseenter", a),
                  n.addEventListener("mouseleave", o),
                  n.addEventListener("focusin", i),
                  n.addEventListener("focusout", s),
                  (n._pauseCleanup = () => {
                    n.removeEventListener("mouseenter", a),
                      n.removeEventListener("mouseleave", o),
                      n.removeEventListener("focusin", i),
                      n.removeEventListener("focusout", s);
                  });
              case 2:
                return e.a(2);
            }
        }, e);
      })
    )).apply(this, arguments);
  }
  function ce(e) {
    return fe.apply(this, arguments);
  }
  function fe() {
    return (fe = r(
      u().m(function e(t) {
        var n, r, a, o, i;
        return u().w(
          function (e) {
            for (;;)
              switch ((e.p = e.n)) {
                case 0:
                  if (((e.p = 0), null != t && t._key)) {
                    e.n = 1;
                    break;
                  }
                  return e.a(2);
                case 1:
                  if ((o = Y.get(t._key))) {
                    e.n = 2;
                    break;
                  }
                  return e.a(2);
                case 2:
                  return (
                    null === (n = o.timer) || void 0 === n || n.clear(),
                    null === (r = o.outer) ||
                      void 0 === r ||
                      null === (a = r._pauseCleanup) ||
                      void 0 === a ||
                      a.call(r),
                    Y.delete(t._key),
                    (J = Math.max(0, J - 1)),
                    (i = o.outer.querySelector(".toast-count-badge")) &&
                      i.remove(),
                    (e.n = 3),
                    he(o.outer)
                  );
                case 3:
                  return (e.n = 4), de();
                case 4:
                  e.n = 6;
                  break;
                case 5:
                  (e.p = 5), e.v;
                case 6:
                  return e.a(2);
              }
          },
          e,
          null,
          [[0, 5]]
        );
      })
    )).apply(this, arguments);
  }
  function de() {
    return pe.apply(this, arguments);
  }
  function pe() {
    return (pe = r(
      u().m(function e() {
        var t, n;
        return u().w(function (e) {
          for (;;)
            switch (e.n) {
              case 0:
                if (!(J < 3 && K.length)) {
                  e.n = 3;
                  break;
                }
                if (((t = K.shift()), !Y.has(t.key))) {
                  e.n = 2;
                  break;
                }
                return ((n = Y.get(t.key)).count += t.count), (e.n = 1), ye(n);
              case 1:
                return e.a(3, 0);
              case 2:
                te(t.options, t.key, t.count), (e.n = 0);
                break;
              case 3:
                return e.a(2);
            }
        }, e);
      })
    )).apply(this, arguments);
  }
  function he(e) {
    return me.apply(this, arguments);
  }
  function me() {
    return (me = r(
      u().m(function e(t) {
        return u().w(function (e) {
          for (;;)
            switch (e.n) {
              case 0:
                if (t) {
                  e.n = 1;
                  break;
                }
                return e.a(2, Promise.resolve());
              case 1:
                return e.a(
                  2,
                  new Promise((e) => {
                    var n = !1,
                      r = () => {
                        n || ((n = !0), m(t), e());
                      },
                      a = t.firstElementChild || t;
                    if (!a) return e();
                    var o = (e) => {
                      try {
                        if (e.target !== a) return;
                        a.removeEventListener("transitionend", o, !0), r();
                      } catch (e) {}
                    };
                    try {
                      a.addEventListener("transitionend", o, !0);
                    } catch (e) {}
                    setTimeout(() => {
                      try {
                        a.removeEventListener("transitionend", o, !0), r();
                      } catch (e) {}
                    }, 700);
                  })
                );
            }
        }, e);
      })
    )).apply(this, arguments);
  }
  function ye(e) {
    return ge.apply(this, arguments);
  }
  function ge() {
    return (ge = r(
      u().m(function e(t) {
        var n, r, a, o;
        return u().w(function (e) {
          for (;;)
            switch (e.n) {
              case 0:
                if (
                  ((n = t.outer), (r = t.count), n && n instanceof HTMLElement)
                ) {
                  e.n = 1;
                  break;
                }
                throw new Error(
                  "updateBadge: outer must be a valid HTMLElement"
                );
              case 1:
                if (!(r < 2)) {
                  e.n = 2;
                  break;
                }
                return (
                  (a = n.querySelector(".toast-count-badge")) && a.remove(),
                  e.a(2)
                );
              case 2:
                (o = n.querySelector(".toast-count-badge")) ||
                  (((o = document.createElement("span")).className =
                    "toast-count-badge"),
                  o.setAttribute(
                    "aria-label",
                    "".concat(r, " identical notifications")
                  ),
                  Object.assign(o.style, {
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    backgroundColor: "#f44336",
                    color: "#fff",
                    borderRadius: "50%",
                    minWidth: "20px",
                    height: "20px",
                    fontSize: "12px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #fff",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                    zIndex: "2",
                    pointerEvents: "none",
                    transition: "transform 150ms ease",
                  }),
                  n.appendChild(o)),
                  (o.textContent = r > 99 ? "99+" : String(r));
                try {
                  (o.style.transform = "scale(1.2)"),
                    setTimeout(() => (o.style.transform = "scale(1)"), 150);
                } catch (e) {}
              case 3:
                return e.a(2);
            }
        }, e);
      })
    )).apply(this, arguments);
  }
  var ve = {
      success: "#28a745",
      error: "#dc3545",
      warning: "#ffc107",
      info: "#17a2b8",
    },
    be = {
      success: "Operation completed successfully!",
      error: "Something went wrong!",
      warning: "Warning message!",
      info: "Information message!",
    },
    we = [],
    ke = !1;
  function xe() {
    return Ce.apply(this, arguments);
  }
  function Ce() {
    return (Ce = r(
      u().m(function e() {
        return u().w(function (e) {
          for (;;)
            switch (e.n) {
              case 0:
                if (!ke) {
                  e.n = 1;
                  break;
                }
                return e.a(2);
              case 1:
                "undefined" != typeof window &&
                  "undefined" != typeof document &&
                  ("complete" === document.readyState ||
                  "interactive" === document.readyState
                    ? ((ke = !0),
                      we.forEach((e) => setTimeout(() => Ee(e), 2500)),
                      (we.length = 0))
                    : document.addEventListener(
                        "DOMContentLoaded",
                        () => {
                          (ke = !0),
                            we.forEach((e) => setTimeout(() => Ee(e), 2500)),
                            (we.length = 0);
                        },
                        { once: !0 }
                      ));
              case 2:
                return e.a(2);
            }
        }, e);
      })
    )).apply(this, arguments);
  }
  function Ee() {
    return Se.apply(this, arguments);
  }
  function Se() {
    return (
      (Se = r(
        u().m(function e() {
          var t,
            n,
            r,
            a = arguments;
          return u().w(
            function (e) {
              for (;;)
                switch ((e.p = e.n)) {
                  case 0:
                    return (
                      (t = a.length > 0 && void 0 !== a[0] ? a[0] : {}),
                      (e.p = 1),
                      (e.n = 2),
                      Le(t)
                    );
                  case 2:
                    return (n = e.v), (e.n = 3), Ae(n);
                  case 3:
                    return (e.n = 4), Z(n);
                  case 4:
                    e.n = 6;
                    break;
                  case 5:
                    (e.p = 5),
                      e.v,
                      (r =
                        "string" == typeof (null == t ? void 0 : t.message) &&
                        null !== (null == t ? void 0 : t.message)
                          ? "".concat(
                              t.message.substring(0, 200),
                              " toast creation failed!"
                            )
                          : "Toast creation failed!"),
                      alert(r);
                  case 6:
                    return e.a(2);
                }
            },
            e,
            null,
            [[1, 5]]
          );
        })
      )),
      Se.apply(this, arguments)
    );
  }
  function Te() {
    return Oe.apply(this, arguments);
  }
  function Oe() {
    return (
      (Oe = r(
        u().m(function e() {
          var t,
            n = arguments;
          return u().w(function (e) {
            for (;;)
              switch (e.n) {
                case 0:
                  if (
                    ((t = n.length > 0 && void 0 !== n[0] ? n[0] : {}),
                    "undefined" != typeof window &&
                      "undefined" != typeof document)
                  ) {
                    e.n = 1;
                    break;
                  }
                  return e.a(2);
                case 1:
                  return (e.n = 2), xe();
                case 2:
                  if (ke) {
                    e.n = 3;
                    break;
                  }
                  return we.push(t), e.a(2);
                case 3:
                  return (e.n = 4), Ee(t);
                case 4:
                  return e.a(2);
              }
          }, e);
        })
      )),
      Oe.apply(this, arguments)
    );
  }
  function Ae(e) {
    return je.apply(this, arguments);
  }
  function je() {
    return (je = r(
      u().m(function e(t) {
        return u().w(
          function (e) {
            for (;;)
              switch ((e.p = e.n)) {
                case 0:
                  return (e.p = 0), (e.n = 1), R(t, H);
                case 1:
                  return e.a(2, e.v);
                case 2:
                  return (e.p = 2), e.v, e.a(2, document.body);
              }
          },
          e,
          null,
          [[0, 2]]
        );
      })
    )).apply(this, arguments);
  }
  function Le(e) {
    return Me.apply(this, arguments);
  }
  function Me() {
    return (Me = r(
      u().m(function e(t) {
        var n, r, a, o, i, l, c, f, d, p;
        return u().w(function (e) {
          for (;;)
            if (0 === e.n) {
              (a =
                null == t ||
                null === (n = t.position) ||
                void 0 === n ||
                null === (n = n.toLowerCase()) ||
                void 0 === n
                  ? void 0
                  : n.trim()),
                (o =
                  (null != a && a.includes("top-full-width")) ||
                  (null != a && a.includes("bottom-full-width"))
                    ? "100vw"
                    : "400px"),
                ((i = s(
                  s(
                    {},
                    {
                      allowHtml: !1,
                      sanitizeHtml: !0,
                      pauseOnHover: void 0,
                      duration: 2500,
                      position: "bottom-right",
                      type: "info",
                      borderRadius: "50px",
                      backgroundColor: void 0,
                      textColor: void 0,
                      showCloseButton: !0,
                      animationDuration: "0.4s",
                      animationType: "fade",
                      animationEasing: "ease",
                      showProgressBar: !0,
                      progressColor: void 0,
                      progressHeight: "4px",
                      progressPosition: "bottom",
                      fontPosition: "relative",
                      fontPadding: void 0,
                      fontBorderRadius: void 0,
                      fontBackgroundColor: void 0,
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                      fontSize: "14px",
                      fontWeight: "400",
                      fontLineHeight: "1.4",
                      fontDirection: "auto",
                      wrapText: "normal",
                      maxWidth: o,
                    }
                  ),
                  "object" != typeof t || Array.isArray(t) ? {} : t
                )).message =
                  null !== (r = null == t ? void 0 : t.message) && void 0 !== r
                    ? r
                    : i.message);
              try {
                i.backgroundColor ||
                  (i.backgroundColor =
                    null !==
                      (c =
                        null === (f = ve) || void 0 === f
                          ? void 0
                          : f[i.type]) && void 0 !== c
                      ? c
                      : window.matchMedia("(prefers-color-scheme: dark)")
                          .matches
                      ? "#f5f5f5"
                      : "#111111"),
                  (i.message =
                    i.message ||
                    (null === (l = be) || void 0 === l ? void 0 : l[i.type]) ||
                    "No Message Provided!"),
                  !i.textColor &&
                    i.backgroundColor &&
                    ((d = k(i.backgroundColor)), (i.textColor = d)),
                  !i.progressColor &&
                    i.backgroundColor &&
                    (i.textColor
                      ? (i.progressColor = i.textColor)
                      : ((p = k(i.backgroundColor)), (i.progressColor = p)));
              } catch (e) {}
              return (
                "string" != typeof i.message &&
                  (i.message = "No Message Provided!"),
                e.a(2, i)
              );
            }
        }, e);
      })
    )).apply(this, arguments);
  }
  function Ie(e) {
    try {
      e && "object" == typeof e && !Array.isArray(e) && (ve = s(s({}, ve), e));
    } catch (e) {}
  }
  function Pe(e) {
    try {
      e && "object" == typeof e && !Array.isArray(e) && (be = s(s({}, be), e));
    } catch (e) {}
  }
  var De = !1,
    ze = null;
  function Ne(e) {
    return Be.apply(this, arguments);
  }
  function Be() {
    return (Be = r(
      u().m(function e(t) {
        return u().w(
          function (e) {
            for (;;)
              switch ((e.p = e.n)) {
                case 0:
                  if (!De || !ze) {
                    e.n = 4;
                    break;
                  }
                  return (e.p = 1), (e.n = 2), ze;
                case 2:
                  e.n = 4;
                  break;
                case 3:
                  (e.p = 3), e.v;
                case 4:
                  return e.a(2, t());
              }
          },
          e,
          null,
          [[1, 3]]
        );
      })
    )).apply(this, arguments);
  }
  var Re = Te;
  function We() {
    return (
      (We = r(
        u().m(function e() {
          var t,
            n = arguments;
          return u().w(function (e) {
            for (;;)
              if (0 === e.n)
                return (
                  (t = n.length > 0 && void 0 !== n[0] ? n[0] : {}),
                  e.a(
                    2,
                    Ne(() => Re(t))
                  )
                );
          }, e);
        })
      )),
      We.apply(this, arguments)
    );
  }
  var He = (function () {
      var e = r(
        u().m(function e() {
          return u().w(function (e) {
            for (;;)
              switch (e.n) {
                case 0:
                  return (
                    (De = !0),
                    (ze = r(
                      u().m(function e() {
                        return u().w(
                          function (e) {
                            for (;;)
                              switch ((e.p = e.n)) {
                                case 0:
                                  return (e.p = 0), (e.n = 1), oe();
                                case 1:
                                  return (
                                    (e.p = 1), (De = !1), (ze = null), e.f(1)
                                  );
                                case 2:
                                  return e.a(2);
                              }
                          },
                          e,
                          null,
                          [[0, , 1, 2]]
                        );
                      })
                    )()),
                    (e.n = 1),
                    ze
                  );
                case 1:
                  return e.a(2);
              }
          }, e);
        })
      );
      return function () {
        return e.apply(this, arguments);
      };
    })(),
    _e = (function () {
      var e = r(
        u().m(function e() {
          return u().w(function (e) {
            for (;;)
              switch (e.n) {
                case 0:
                  return (
                    (De = !0),
                    (ze = r(
                      u().m(function e() {
                        return u().w(
                          function (e) {
                            for (;;)
                              switch ((e.p = e.n)) {
                                case 0:
                                  return (e.p = 0), (e.n = 1), ie();
                                case 1:
                                  return (
                                    (e.p = 1), (De = !1), (ze = null), e.f(1)
                                  );
                                case 2:
                                  return e.a(2);
                              }
                          },
                          e,
                          null,
                          [[0, , 1, 2]]
                        );
                      })
                    )()),
                    (e.n = 1),
                    ze
                  );
                case 1:
                  return e.a(2);
              }
          }, e);
        })
      );
      return function () {
        return e.apply(this, arguments);
      };
    })();
  if ("undefined" != typeof window && "undefined" != typeof document) {
    var qe = !1;
    if (!qe) {
      window.addEventListener(
        "keydown",
        (e) => {
          ("Escape" !== e.key && "Esc" !== e.key) ||
            r(
              u().m(function e() {
                return u().w(function (e) {
                  for (;;)
                    switch (e.n) {
                      case 0:
                        return (
                          (De = !0),
                          (ze = r(
                            u().m(function e() {
                              return u().w(
                                function (e) {
                                  for (;;)
                                    switch ((e.p = e.n)) {
                                      case 0:
                                        return (e.p = 0), (e.n = 1), oe();
                                      case 1:
                                        return (
                                          (e.p = 1),
                                          (De = !1),
                                          (ze = null),
                                          e.f(1)
                                        );
                                      case 2:
                                        return e.a(2);
                                    }
                                },
                                e,
                                null,
                                [[0, , 1, 2]]
                              );
                            })
                          )()),
                          (e.n = 1),
                          ze
                        );
                      case 1:
                        return e.a(2);
                    }
                }, e);
              })
            )();
        },
        { passive: !0 }
      ),
        (qe = !0);
    }
  }
  var Fe = (function () {
    var e = r(
      u().m(function e() {
        return u().w(function (e) {
          for (;;)
            switch (e.n) {
              case 0:
                return (e.n = 1), ie();
              case 1:
                return e.a(2);
            }
        }, e);
      })
    );
    return function () {
      return e.apply(this, arguments);
    };
  })();
  try {
    "undefined" != typeof window &&
      (window.customizableToast = {
        createToast: Te,
        setDefaultColors: Ie,
        setDefaultMessages: Pe,
        noop: Fe,
        dismiss: oe,
      });
  } catch (e) {}
  (e.createToast = function () {
    return We.apply(this, arguments);
  }),
    (e.dismiss = He),
    (e.dismissToast = He),
    (e.noop = _e),
    (e.noopAll = _e),
    (e.setDefaultColors = Ie),
    (e.setDefaultMessages = Pe);
});
