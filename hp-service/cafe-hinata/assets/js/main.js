// ひなた珈琲 site — shared behaviour

document.addEventListener('DOMContentLoaded', () => {
  /* ---------- Footer year ---------- */
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Header scroll style ---------- */
  const header = document.getElementById('site-header');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 12) {
        header.classList.add('bg-white/95', 'shadow-md', 'backdrop-blur');
        header.classList.remove('bg-transparent');
      } else if (header.dataset.transparentHero === 'true') {
        header.classList.remove('bg-white/95', 'shadow-md', 'backdrop-blur');
        header.classList.add('bg-transparent');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Mobile nav toggle ---------- */
  const menuBtn = document.getElementById('menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  const menuIconOpen = document.getElementById('icon-open');
  const menuIconClose = document.getElementById('icon-close');
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (menuIconOpen && menuIconClose) {
        menuIconOpen.classList.toggle('hidden', isOpen);
        menuIconClose.classList.toggle('hidden', !isOpen);
      }
    });
    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        if (menuIconOpen && menuIconClose) {
          menuIconOpen.classList.remove('hidden');
          menuIconClose.classList.add('hidden');
        }
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Active nav link highlighting ---------- */
  const currentPage = (window.location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const target = link.getAttribute('data-nav-link');
    if (target === currentPage) {
      link.classList.add('text-clay-600', 'font-bold');
      link.classList.remove('text-ink-700');
    }
  });

  /* ---------- Contact form (demo submit) ---------- */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('[type="submit"]');
      const feedback = document.getElementById('form-feedback');
      const btnLabel = submitBtn.querySelector('.btn-label');
      const btnSpinner = submitBtn.querySelector('.spinner');

      if (!contactForm.checkValidity()) {
        contactForm.reportValidity();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-80', 'cursor-not-allowed');
      if (btnLabel) btnLabel.textContent = '送信中...';
      if (btnSpinner) btnSpinner.classList.remove('hidden');

      // Demo環境のため実際の送信は行わず、送信成功のUIのみ表示します。
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-80', 'cursor-not-allowed');
        if (btnLabel) btnLabel.textContent = 'メッセージを送信する';
        if (btnSpinner) btnSpinner.classList.add('hidden');
        contactForm.reset();
        if (feedback) {
          feedback.classList.remove('hidden');
          feedback.classList.add('flex');
          feedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            feedback.classList.add('hidden');
            feedback.classList.remove('flex');
          }, 6000);
        }
      }, 1200);
    });
  }
});
