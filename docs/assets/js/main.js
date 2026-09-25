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
    if (!trigger) return;
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

  /* ---------- Год в подвале ---------- */
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
})();
