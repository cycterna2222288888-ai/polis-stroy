/* Полис — небольшие улучшения поверх статичной страницы.
   Без JS всё работает: ссылки, телефоны и почта остаются обычными ссылками. */
(() => {
  const root = document.documentElement;
  const MAIL = 'info@polis-stroy.ru';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Шапка: фон при прокрутке + запасной индикатор прогресса ---------- */
  const header = document.querySelector('[data-header]');
  const progress = header && header.querySelector('.progress');
  const hasScrollTimeline = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()');
  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 8);
      if (progress && !hasScrollTimeline && !reduceMotion.matches) {
        const max = root.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
      }
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Мобильное меню ---------- */
  const toggle = document.querySelector('[data-menu-toggle]');
  const toggleLabel = toggle.querySelector('.menu-toggle__label');

  const setMenu = (open) => {
    root.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggleLabel.textContent = open ? 'Закрыть' : 'Меню';
  };

  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  document.querySelectorAll('.nav__list a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('menu-open')) {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 68em)').addEventListener('change', (e) => {
    if (e.matches) setMenu(false);
  });

  /* ---------- Появление блоков и подсветка текущего раздела ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  const navLinks = new Map(
    [...document.querySelectorAll('.nav__list a[href^="#"]')].map((a) => [a.getAttribute('href').slice(1), a])
  );

  if ('IntersectionObserver' in window) {
    const revealer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          revealer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    );
    revealEls.forEach((el) => revealer.observe(el));

    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const link = navLinks.get(entry.target.id);
          if (link) link.classList.toggle('is-current', entry.isIntersecting);
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    navLinks.forEach((_, id) => {
      const section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Тема обращения: услуга или категория → тема письма ---------- */
  const topicOut = document.querySelector('[data-topic-out]');
  const mailtoBtn = document.querySelector('[data-mailto]');
  const topicReset = document.querySelector('[data-topic-reset]');
  const defaultTopic = topicOut.textContent;
  let flashTimer;

  const setTopic = (topic) => {
    topicOut.textContent = topic || defaultTopic;
    const subject = topic ? `Запрос с сайта: ${topic}` : 'Запрос с сайта';
    mailtoBtn.href = `mailto:${MAIL}?subject=${encodeURIComponent(subject)}`;
    topicReset.hidden = !topic;

    clearTimeout(flashTimer);
    topicOut.classList.remove('is-flash');
    // Подсветка — когда плавная прокрутка уже почти доехала до контактов
    flashTimer = setTimeout(() => topicOut.classList.add('is-flash'), reduceMotion.matches ? 0 : 550);
  };

  const requestBox = document.querySelector('[data-request]');

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-topic]');
    // На телефоне касание добавляет позицию в заявку — это обрабатывает док ниже
    if (!trigger || root.classList.contains('is-handheld')) return;
    // Вместо прыжка к началу контактов — сразу к блоку с темой письма
    e.preventDefault();
    setTopic(trigger.dataset.topic);
    requestBox.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
    mailtoBtn.focus({ preventScroll: true });
  });
  topicReset.addEventListener('click', () => setTopic(''));

  /* ---------- Копирование e-mail ---------- */
  const toastEl = document.querySelector('[data-toast]');
  let toastTimer;
  const toast = (text) => {
    toastEl.textContent = text;
    requestAnimationFrame(() => toastEl.classList.add('is-on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
  };

  const copyBtn = document.querySelector('[data-copy]');
  if (copyBtn && navigator.clipboard && window.isSecureContext) {
    copyBtn.hidden = false;
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(copyBtn.dataset.copy);
        copyBtn.textContent = 'Скопировано';
        copyBtn.classList.add('is-done');
        toast('E-mail скопирован');
        setTimeout(() => {
          copyBtn.textContent = 'Копировать';
          copyBtn.classList.remove('is-done');
        }, 2200);
      } catch {
        toast('Не удалось скопировать');
      }
    });
  }

  /* ==========================================================================
     Телефон: док «Лифт + Заявка»
     Лифт — этажи страницы под большим пальцем: ведёшь пальцем по доку,
     страница едет за ним, на каждом этаже — короткий тактильный щелчок.
     Заявка — касание (или свайп строки вправо) кладёт услугу/материал в смету;
     одна кнопка отправляет весь список письмом, копирует его или звонит.
     ========================================================================== */
  const handheldMq = window.matchMedia('(max-width: 47.99em)');
  const dock = document.querySelector('[data-dock]');
  const buzz = (pattern) => {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* нет вибро — не страшно */ }
  };

  /* ---------- Заявка: состояние ---------- */
  const STORE_KEY = 'polis-cart';
  let cart = [];
  try { cart = JSON.parse(sessionStorage.getItem(STORE_KEY)) || []; } catch { cart = []; }
  const saveCart = () => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch { /* приватный режим */ }
  };

  const pickables = [...document.querySelectorAll('.svc__row[data-topic], .tile__link[data-topic]')];
  const kindOf = (el) => (el.classList.contains('svc__row') ? 'service' : 'material');
  const inCart = (name) => cart.some((item) => item.name === name);

  const cartBody = () => {
    const services = cart.filter((i) => i.kind === 'service');
    const materials = cart.filter((i) => i.kind === 'material');
    const block = (title, items) => (items.length ? `${title}:\n${items.map((i, n) => `${n + 1}. ${i.name}`).join('\n')}\n\n` : '');
    return `Здравствуйте! Прошу связаться и рассчитать.\n\n${block('Услуги', services)}${block('Материалы', materials)}Объект / адрес:\nТелефон для связи:\n`;
  };
  const cartMailto = () => {
    const subject = `Заявка с сайта: ${cart.length} ${plural(cart.length, 'позиция', 'позиции', 'позиций')}`;
    return `mailto:${MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(cartBody())}`;
  };
  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  const countEl = document.querySelector('[data-cart-count]');
  const listEl = document.querySelector('[data-cart-list]');
  const emptyEl = document.querySelector('[data-cart-empty]');
  const totalEl = document.querySelector('[data-cart-total]');
  const mailEl = document.querySelector('[data-cart-mail]');
  const cartOpenBtn = document.querySelector('[data-cart-open]');
  let requestOverridden = false;

  const renderCart = () => {
    pickables.forEach((el) => {
      const picked = inCart(el.dataset.topic);
      el.classList.toggle('is-picked', picked);
      if (root.classList.contains('is-handheld')) el.setAttribute('aria-pressed', String(picked));
    });

    countEl.textContent = String(cart.length);
    cartOpenBtn.classList.toggle('has-items', cart.length > 0);
    cartOpenBtn.setAttribute('aria-label', `Заявка: ${cart.length} ${plural(cart.length, 'позиция', 'позиции', 'позиций')}`);
    totalEl.textContent = cart.length ? `· ${cart.length}` : '';
    emptyEl.hidden = cart.length > 0;
    mailEl.href = cart.length ? cartMailto() : `mailto:${MAIL}`;
    mailEl.classList.toggle('is-disabled', !cart.length);

    listEl.replaceChildren(...cart.map((item, i) => {
      const li = document.createElement('li');
      li.className = 'sheet__item';
      li.innerHTML = `<span class="sheet__n">${String(i + 1).padStart(2, '0')}</span>
        <span class="sheet__name"></span>
        <span class="sheet__kind">${item.kind === 'service' ? 'услуга' : 'материал'}</span>
        <button class="sheet__rm" type="button" aria-label="Убрать">×</button>`;
      li.querySelector('.sheet__name').textContent = item.name;
      li.querySelector('.sheet__rm').addEventListener('click', () => {
        li.classList.add('is-leaving');
        buzz([6, 40, 6]);
        setTimeout(() => toggleItem(item.name, item.kind), reduceMotion.matches ? 0 : 220);
      });
      return li;
    }));

    // Блок «Тема обращения» в контактах тоже знает про заявку
    if (cart.length) {
      topicOut.textContent = `Заявка · ${cart.length} ${plural(cart.length, 'позиция', 'позиции', 'позиций')}`;
      mailtoBtn.href = cartMailto();
      topicReset.hidden = true;
      requestOverridden = true;
    } else if (requestOverridden) {
      requestOverridden = false;
      setTopic('');
    }
  };

  function toggleItem(name, kind) {
    const was = inCart(name);
    cart = was ? cart.filter((i) => i.name !== name) : [...cart, { name, kind }];
    saveCart();
    renderCart();
    return !was;
  }

  /* Квадратик «прилетает» в счётчик заявки */
  const flyToCart = (fromX, fromY) => {
    cartOpenBtn.classList.remove('is-bump');
    void cartOpenBtn.offsetWidth;
    cartOpenBtn.classList.add('is-bump');
    if (reduceMotion.matches || !Element.prototype.animate) return;
    const target = countEl.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'fly-dot';
    dot.style.left = `${fromX - 7}px`;
    dot.style.top = `${fromY - 7}px`;
    document.body.appendChild(dot);
    const dx = target.left + target.width / 2 - fromX;
    const dy = target.top + target.height / 2 - fromY;
    dot.animate(
      [
        { transform: 'translate(0,0) rotate(0) scale(1)' },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 60}px) rotate(90deg) scale(1.15)`, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) rotate(180deg) scale(0.5)` },
      ],
      { duration: 560, easing: 'cubic-bezier(.5,0,.3,1)' }
    ).onfinish = () => dot.remove();
  };

  const pick = (el, x, y) => {
    const added = toggleItem(el.dataset.topic, kindOf(el));
    if (added) {
      buzz(12);
      flyToCart(x, y);
      toast(`В заявке: ${el.dataset.topic}`);
    } else {
      buzz([6, 40, 6]);
      toast('Убрано из заявки');
    }
  };

  /* Касание по услуге или плитке каталога */
  let suppressClick = false;
  document.addEventListener('click', (e) => {
    if (!root.classList.contains('is-handheld')) return;
    const el = e.target.closest('.svc__row[data-topic], .tile__link[data-topic]');
    if (!el) return;
    e.preventDefault();
    if (suppressClick) { suppressClick = false; return; }
    const r = el.getBoundingClientRect();
    pick(el, e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
  });

  /* Свайп строки услуги вправо — положить в заявку (или убрать) */
  const SWIPE_AT = 0.32;
  document.querySelectorAll('.svc__row[data-topic]').forEach((row) => {
    let x0 = 0, y0 = 0, dx = 0, mode = null, pid = null;
    const reset = () => {
      row.style.transform = '';
      row.parentElement.style.removeProperty('--reveal');
      row.parentElement.classList.remove('is-armed');
      mode = null;
      pid = null;
    };
    row.addEventListener('pointerdown', (e) => {
      if (!root.classList.contains('is-handheld') || e.pointerType === 'mouse') return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; mode = 'pending'; pid = e.pointerId;
    });
    row.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid || !mode) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (mode === 'pending') {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { mode = null; return; } // это прокрутка
        if (mx > 10 && Math.abs(mx) > Math.abs(my)) {
          mode = 'swipe';
          row.setPointerCapture(pid);
          row.classList.add('is-swiping');
        } else return;
      }
      dx = Math.max(0, mx);
      const w = row.offsetWidth;
      const eased = dx < w * 0.5 ? dx : w * 0.5 + (dx - w * 0.5) * 0.25; // упругий край
      row.style.transform = `translateX(${eased}px)`;
      row.parentElement.style.setProperty('--reveal', `${eased}px`);
      const armed = dx > w * SWIPE_AT;
      if (armed !== row.parentElement.classList.contains('is-armed')) {
        row.parentElement.classList.toggle('is-armed', armed);
        buzz(armed ? 8 : 4);
      }
    });
    const end = (e) => {
      if (e.pointerId !== pid) return;
      if (mode === 'swipe') {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 400);
        row.classList.remove('is-swiping');
        if (dx > row.offsetWidth * SWIPE_AT) {
          const r = row.getBoundingClientRect();
          pick(row, r.left + 40, r.top + r.height / 2);
        }
      }
      reset();
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
  });

  /* Подсказка: первый раз, когда список услуг появляется на экране, строка «подмигивает» */
  const hintRow = document.querySelector('.svc li:first-child');
  let hinted = false;
  try { hinted = sessionStorage.getItem('polis-hint') === '1'; } catch { /* ok */ }
  if (hintRow && 'IntersectionObserver' in window) {
    const hintIo = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || hinted || !root.classList.contains('is-handheld') || cart.length) return;
      if (lift.classList.contains('is-scrubbing')) return; // пролетаем этаж на лифте — подсказку покажем позже
      hinted = true;
      try { sessionStorage.setItem('polis-hint', '1'); } catch { /* ok */ }
      hintIo.disconnect();
      setTimeout(() => {
        if (!reduceMotion.matches) hintRow.classList.add('is-hint');
        toast('Смахните вправо — в заявку');
        setTimeout(() => hintRow.classList.remove('is-hint'), 1600);
      }, 450);
    }, { threshold: 1 });
    hintIo.observe(hintRow);
  }

  /* ---------- Нижний лист «Заявка» ---------- */
  const sheet = document.querySelector('[data-sheet]');
  const panel = sheet.querySelector('[data-sheet-panel]');
  const grip = sheet.querySelector('[data-sheet-grip]');
  let lastFocus = null;

  const openSheet = () => {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    root.classList.add('sheet-open');
    toastEl.classList.remove('is-on');
    requestAnimationFrame(() => sheet.classList.add('is-open'));
    buzz(6);
    setTimeout(() => sheet.querySelector('.sheet__x').focus({ preventScroll: true }), 50);
  };
  const closeSheet = () => {
    sheet.classList.remove('is-open');
    root.classList.remove('sheet-open');
    panel.style.transform = '';
    setTimeout(() => { if (!sheet.classList.contains('is-open')) sheet.hidden = true; }, reduceMotion.matches ? 0 : 380);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  };

  cartOpenBtn.addEventListener('click', openSheet);
  sheet.querySelectorAll('[data-sheet-close]').forEach((el) => el.addEventListener('click', closeSheet));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('is-open')) closeSheet();
  });

  // Лист тянется пальцем вниз и закрывается, если отпустить ниже порога
  let sy0 = 0, sdy = 0, spid = null;
  grip.parentElement.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('[data-sheet-grip], .sheet__head') || e.target.closest('button')) return;
    spid = e.pointerId; sy0 = e.clientY; sdy = 0;
    panel.setPointerCapture(spid);
    panel.classList.add('is-dragging');
  });
  panel.addEventListener('pointermove', (e) => {
    if (e.pointerId !== spid) return;
    sdy = Math.max(0, e.clientY - sy0);
    panel.style.transform = `translateY(${sdy}px)`;
  });
  const sheetEnd = (e) => {
    if (e.pointerId !== spid) return;
    spid = null;
    panel.classList.remove('is-dragging');
    if (sdy > Math.min(140, panel.offsetHeight * 0.28)) closeSheet();
    else panel.style.transform = '';
  };
  panel.addEventListener('pointerup', sheetEnd);
  panel.addEventListener('pointercancel', sheetEnd);

  sheet.querySelector('[data-cart-clear]').addEventListener('click', () => {
    if (!cart.length) return;
    cart = [];
    saveCart();
    renderCart();
    buzz([6, 40, 6]);
    toast('Заявка очищена');
  });
  sheet.querySelector('[data-cart-copy]').addEventListener('click', async () => {
    if (!cart.length) { toast('Сначала добавьте позиции'); return; }
    try {
      await navigator.clipboard.writeText(cartBody());
      toast('Список скопирован — вставьте в мессенджер');
    } catch {
      toast('Не удалось скопировать');
    }
  });
  mailEl.addEventListener('click', (e) => {
    if (!cart.length) { e.preventDefault(); toast('Сначала добавьте позиции'); buzz([6, 40, 6]); }
  });

  /* ---------- Лифт ---------- */
  const lift = document.querySelector('[data-lift]');
  const floors = [...lift.querySelectorAll('[data-floor]')];
  const floorTargets = floors.map((btn) => document.getElementById(btn.dataset.floor));
  const loupe = lift.querySelector('[data-lift-loupe]');
  const loupeNum = lift.querySelector('[data-loupe-num]');
  const loupeName = lift.querySelector('[data-loupe-name]');
  let current = -1;

  const floorTop = (i) => (i === 0 ? 0 : floorTargets[i].getBoundingClientRect().top + window.scrollY - header.offsetHeight + 1);

  const setCurrent = (i, progress) => {
    if (i !== current) {
      floors.forEach((btn, n) => {
        btn.classList.toggle('is-current', n === i);
        if (n === i) btn.setAttribute('aria-current', 'location');
        else btn.removeAttribute('aria-current');
      });
      current = i;
    }
    floors[i].style.setProperty('--p', progress.toFixed(3));
  };

  const trackFloor = () => {
    if (!root.classList.contains('is-handheld') || lift.classList.contains('is-scrubbing')) return;
    const probe = window.scrollY + window.innerHeight * 0.35;
    let i = 0;
    for (let n = floorTargets.length - 1; n >= 0; n--) {
      if (floorTop(n) <= probe) { i = n; break; }
    }
    const top = floorTop(i);
    const bottom = i < floorTargets.length - 1 ? floorTop(i + 1) : root.scrollHeight;
    setCurrent(i, Math.min(1, Math.max(0, (probe - top) / (bottom - top))));
  };
  let liftTick = false;
  window.addEventListener('scroll', () => {
    if (liftTick) return;
    liftTick = true;
    requestAnimationFrame(() => { trackFloor(); liftTick = false; });
  }, { passive: true });

  const goFloor = (i, smooth) => {
    window.scrollTo({ top: floorTop(i), behavior: smooth && !reduceMotion.matches ? 'smooth' : 'instant' });
  };

  // Пальцем по доку: этаж под пальцем, страница едет следом, лупа показывает этаж
  let lpid = null, lx0 = 0, scrubbing = false, scrubFloor = -1;
  const floorAt = (x) => {
    const rects = floors.map((b) => b.getBoundingClientRect());
    const n = rects.findIndex((r) => x >= r.left && x <= r.right);
    if (n !== -1) return n;
    return x < rects[0].left ? 0 : floors.length - 1;
  };
  const showLoupe = (i, x) => {
    loupeNum.textContent = floors[i].querySelector('.lift__num').textContent;
    loupeName.textContent = floors[i].querySelector('.lift__name').textContent;
    const w = loupe.offsetWidth;
    const lr = lift.getBoundingClientRect();
    const left = Math.min(Math.max(x - lr.left - w / 2, 0), lr.width - w);
    loupe.style.transform = `translateX(${left}px)`;
    loupe.classList.remove('is-tick');
    void loupe.offsetWidth;
    loupe.classList.add('is-tick');
  };

  lift.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    lpid = e.pointerId; lx0 = e.clientX; scrubbing = false;
    scrubFloor = floorAt(e.clientX);
    lift.setPointerCapture(lpid);
  });
  lift.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lpid) return;
    if (!scrubbing && Math.abs(e.clientX - lx0) > 6) {
      scrubbing = true;
      lift.classList.add('is-scrubbing');
      buzz(6);
    }
    if (!scrubbing) return;
    const i = floorAt(e.clientX);
    if (i !== scrubFloor || !loupe.classList.contains('is-on')) {
      if (i !== scrubFloor) buzz(8);
      scrubFloor = i;
      loupe.classList.add('is-on');
      showLoupe(i, e.clientX);
      setCurrent(i, 0);
      goFloor(i, false);
    } else {
      const lr = lift.getBoundingClientRect();
      const left = Math.min(Math.max(e.clientX - lr.left - loupe.offsetWidth / 2, 0), lr.width - loupe.offsetWidth);
      loupe.style.transform = `translateX(${left}px)`;
    }
  });
  const liftEnd = (e) => {
    if (e.pointerId !== lpid) return;
    lpid = null;
    if (scrubbing) {
      lift.classList.remove('is-scrubbing');
      loupe.classList.remove('is-on');
      scrubbing = false;
      requestAnimationFrame(trackFloor);
    } else if (e.type === 'pointerup') {
      buzz(6);
      goFloor(scrubFloor, true);
    }
  };
  lift.addEventListener('pointerup', liftEnd);
  lift.addEventListener('pointercancel', liftEnd);
  // Клавиатура и скринридеры: обычное нажатие кнопки
  floors.forEach((btn, i) => btn.addEventListener('click', (e) => { if (e.detail === 0) goFloor(i, true); }));

  /* ---------- Включение/выключение по ширине экрана ---------- */
  const applyHandheld = () => {
    const on = handheldMq.matches;
    root.classList.toggle('is-handheld', on);
    dock.hidden = !on;
    pickables.forEach((el) => {
      if (on) el.setAttribute('aria-pressed', String(inCart(el.dataset.topic)));
      else el.removeAttribute('aria-pressed');
    });
    if (!on && sheet.classList.contains('is-open')) closeSheet();
    if (on) trackFloor();
  };
  handheldMq.addEventListener('change', applyHandheld);
  applyHandheld();
  renderCart();

  /* ---------- Год в подвале ---------- */
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
})();
