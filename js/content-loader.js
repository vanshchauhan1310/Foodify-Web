/**
 * Foodify — CMS content loader (plain JS / ES module, no framework).
 *
 * How it works:
 *   1. Each page includes this module with a data-page attribute:
 *        <script type="module" src="js/content-loader.js" data-page="homepage"></script>
 *   2. It fetches (a) the single Global Settings document and (b) the page
 *      document whose _type matches data-page.
 *   3. It applies content to elements marked with data-cms attributes:
 *        data-cms="heroHeading"   -> sets textContent
 *        data-cms-html="story"    -> sets innerHTML (portable text)
 *        data-cms-img="heroImage" -> sets src (via Sanity image CDN)
 *        data-cms-href="ctaUrl"   -> sets href
 *   4. If Sanity is unreachable or a field is missing, the existing
 *      hardcoded HTML is left untouched (graceful fallback).
 *
 * Field paths are resolved with dot notation on the fetched document,
 * e.g. data-cms="servicesIntro.heading".
 */

import {sanityFetch, imageUrl} from './sanity.js'

function getPageName() {
  const script =
    document.currentScript ||
    document.querySelector('script[src*="content-loader"]')
  return script && script.dataset.page ? script.dataset.page : null
}

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj)
}

/** Convert Sanity portable-text blocks into simple HTML paragraphs. */
function portableTextToHtml(blocks) {
  if (!Array.isArray(blocks)) return null
  const html = blocks
    .map((b) => {
      if (!b || b._type !== 'block' || !Array.isArray(b.children)) return ''
      const text = b.children.map((c) => (c && c.text ? c.text : '')).join('')
      if (!text.trim()) return ''
      if (b.style === 'h2') return `<h2>${text}</h2>`
      if (b.style === 'h3') return `<h3>${text}</h3>`
      return `<p>${text}</p>`
    })
    .join('')
  return html || null
}

function setText(el, value) {
  if (!el || value == null || value === '') return
  el.textContent = value
}

function setHtml(el, value) {
  if (!el || value == null || value === '') return
  el.innerHTML = value
}

async function setImage(el, value, opts) {
  if (!el || !value) return
  const url = await imageUrl(value, opts)
  if (url) el.src = url
}

function setHref(el, value) {
  if (!el || !value) return
  el.setAttribute('href', value)
}

/** Apply data-cms hooks relative to a document. */
async function applyDocument(doc, scope = document) {
  if (!doc) return

  // Text
  scope.querySelectorAll('[data-cms]').forEach((el) => {
    setText(el, resolvePath(doc, el.dataset.cms))
  })

  // Rich text (portable text -> HTML)
  scope.querySelectorAll('[data-cms-html]').forEach((el) => {
    const value = resolvePath(doc, el.dataset.cmsHtml)
    setHtml(el, portableTextToHtml(value) ?? (typeof value === 'string' ? value : null))
  })

  // Images
  const imgEls = [...scope.querySelectorAll('[data-cms-img]')]
  await Promise.all(
    imgEls.map((el) => {
      const [path, w, h, fit] = el.dataset.cmsImg.split('|')
      return setImage(el, resolvePath(doc, path), {
        width: w ? Number(w) : undefined,
        height: h ? Number(h) : undefined,
        fit: fit || undefined,
      })
    })
  )

  // Links
  scope.querySelectorAll('[data-cms-href]').forEach((el) => {
    setHref(el, resolvePath(doc, el.dataset.cmsHref))
  })
}


function renderSectors(sectors) {
  const el = container('sectors')
  if (!el || !Array.isArray(sectors) || !sectors.length) return
  el.innerHTML = sectors
    .map(
      (s, i) => `
      <a class="text-center animate-on-scroll fade-in-up is-visible${i === 1 ? ' delay-100' : i === 2 ? ' delay-200' : ''} group block" href="${esc(s.linkUrl || '#')}">
        <div class="h-64 rounded-2xl overflow-hidden mb-6 border border-transparent group-hover:border-action-lime transition-all">
          <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="${esc(s.title)}" src="${esc(s.image || '')}" ${s.image ? '' : 'style="display:none"'}/>
        </div>
        <h3 class="font-headline-lg text-headline-lg-mobile text-primary mb-3 group-hover:text-action-lime transition-colors">${esc(s.title)}</h3>
        <p class="font-body-md text-body-md text-secondary">${esc(s.shortDescription)}</p>
      </a>`
    )
    .join('')
}

function renderTestimonials(testimonials) {
  const el = container('testimonials')
  if (!el || !Array.isArray(testimonials) || !testimonials.length) return
  el.innerHTML = testimonials
    .map(
      (t, i) => `
      <div class="bg-white p-8 rounded-2xl border border-slate-muted flex flex-col justify-between shadow-sm animate-on-scroll fade-in-up${i === 1 ? ' delay-100' : i === 2 ? ' delay-200' : ''} is-visible">
        <div>
          <div class="flex text-action-lime mb-6">
            ${'<span class="material-symbols-outlined" data-icon="star">star</span>'.repeat(Math.max(1, Math.min(5, t.rating || 5)))}
          </div>
          <p class="font-body-lg text-body-lg text-secondary mb-8">&ldquo;${esc(t.quote)}&rdquo;</p>
        </div>
        <div>
          <p class="font-headline-lg text-[20px] text-primary font-bold">${esc(t.authorName)}</p>
          <p class="font-label-md text-label-md text-secondary mt-1">${esc(t.authorRole || t.company || '')}</p>
        </div>
      </div>`
    )
    .join('')
}

function renderPlans(plans) {
  const el = container('plans')
  if (!el || !Array.isArray(plans) || !plans.length) return
  el.innerHTML = plans
    .map(
      (p) => `
      <div class="relative bg-white ${p.highlighted ? 'border-2 border-action-lime shadow-lg' : 'border border-slate-muted'} p-8 rounded-2xl card-hover flex flex-col ${p.highlighted ? 'md:scale-105 z-10' : ''}">
        ${p.highlighted ? '<span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-action-lime text-forest-deep px-4 py-1 rounded-full font-label-md text-[12px] font-bold">MOST POPULAR</span>' : ''}
        <h3 class="font-headline-lg text-[24px] font-semibold text-primary mb-2">${esc(p.name)}</h3>
        <p class="font-body-md text-body-md text-secondary mb-6">${esc(p.tagline || '')}</p>
        <div class="mb-8">
          <span class="font-display-lg text-4xl font-bold text-primary">${esc(p.price)}</span>
          <span class="font-label-md text-label-md text-secondary">${esc(p.period || '')}</span>
        </div>
        <ul class="space-y-4 mb-10 flex-grow">
          ${(p.features || [])
            .map(
              (f) => `<li class="flex items-start gap-3"><span class="material-symbols-outlined text-action-lime text-sm mt-0.5" data-icon="check">check</span><span class="font-body-md text-body-md text-primary">${esc(f)}</span></li>`
            )
            .join('')}
        </ul>
        <a class="bg-primary text-on-primary text-center px-8 py-3 rounded-full font-label-md text-label-md hover:bg-forest-deep transition-colors" href="${esc((p.cta && p.cta.url) || 'Contact.html')}">${esc((p.cta && p.cta.label) || 'Get Started')}</a>
      </div>`
    )
    .join('')
}

function renderFaqs(faqs, heading) {
  const label = document.querySelector('[data-cms="faqHeading"]')
  if (label && heading) label.textContent = heading
  const el = container('faqs')
  if (!el || !Array.isArray(faqs) || !faqs.length) return
  el.innerHTML = faqs
    .map(
      (f) => `
      <div class="bg-white p-8 rounded-2xl border border-slate-muted">
        <h3 class="font-headline-lg text-[20px] font-semibold text-primary mb-3">${esc(f.question)}</h3>
        <p class="font-body-md text-body-md text-secondary">${esc((f.answer || []).map((b) => (b.children || []).map((c) => c.text || '').join('')).join(' '))}</p>
      </div>`
    )
    .join('')
}

function renderContactChannels(channels) {
  const el = container('contactChannels')
  if (!el || !Array.isArray(channels) || !channels.length) return
  el.innerHTML = channels
    .map(
      (c) => `
      <div class="bg-white p-8 rounded-2xl border border-slate-muted text-center card-hover">
        <div class="w-12 h-12 rounded-full bg-action-lime/20 flex items-center justify-center mb-6 mx-auto">
          <span class="material-symbols-outlined text-action-lime" data-icon="${esc(c.iconName || 'info')}">${esc(c.iconName || 'info')}</span>
        </div>
        <h3 class="font-headline-lg text-[20px] font-semibold text-primary mb-2">${esc(c.title)}</h3>
        <p class="font-body-md text-body-md text-secondary">${esc(c.description)}</p>
      </div>`
    )
    .join('')
}

function setHeroVideo(url) {
  if (!url) return
  const source = document.querySelector('[data-cms-video] source') || document.querySelector('video source')
  if (source) source.src = url
}

/** Global settings: footer description, copyright, contact + social links. */
async function applyGlobalSettings() {
  const settings = await sanityFetch(
    `*[_type == "siteSettings"][0]{
      siteName, logo, mainPhone, mainEmail, contactInfo,
      socialLinks, footerTagline, footerDescription,
      footerLinks, copyrightText
    }`
  )
  if (!settings) return

  setText(document.querySelector('[data-cms-footer="footerDescription"]'), settings.footerDescription)
  setText(document.querySelector('[data-cms-footer="copyrightText"]'), settings.copyrightText)
  setText(document.querySelector('[data-cms-footer="contactInfo"]'), settings.contactInfo)

  const logoImg = document.querySelector('[data-cms-img="logo"]')
  if (logoImg) await setImage(logoImg, settings.logo, {width: 160})

  // Social links: rebuild the icon row when present in the CMS.
  const socialRow = document.querySelector('[data-cms-social]')
  if (socialRow && Array.isArray(settings.socialLinks) && settings.socialLinks.length) {
    const icons = ['public', 'mail', 'call', 'language']
    socialRow.innerHTML = settings.socialLinks
      .map((l, i) => {
        const icon = icons[i % icons.length]
        const external = l.openInNewTab ? ' target="_blank" rel="noopener"' : ''
        return `<a class="w-10 h-10 rounded-full border border-secondary/40 flex items-center justify-center text-cream-soft hover:border-action-lime hover:text-action-lime transition-colors" href="${l.url}"${external} aria-label="${l.label || 'Social link'}"><span class="material-symbols-outlined" data-icon="${icon}">${icon}</span></a>`
      })
      .join('')
  }

  // Footer link columns: optional override.
  const footerLinks = document.querySelector('[data-cms-footer-links]')
  if (footerLinks && Array.isArray(settings.footerLinks) && settings.footerLinks.length) {
    footerLinks.innerHTML = settings.footerLinks
      .map((l) => {
        const external = l.openInNewTab ? ' target="_blank" rel="noopener"' : ''
        return `<li><a class="font-body-md text-body-md text-secondary-fixed-dim hover:text-action-lime transition-colors" href="${l.url}"${external}>${l.label}</a></li>`
      })
      .join('')
  }
}

/** Escape text for safe interpolation into template strings. */
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function container(name) {
  return document.querySelector(`[data-cms-list="${name}"]`)
}

/* ---------- list renderers (templates mirror the hardcoded cards) ---------- */

function renderStats(stats) {
  const el = container('stats')
  if (!el || !Array.isArray(stats) || !stats.length) return
  el.innerHTML = stats
    .map(
      (s) => `
      <div class="text-center">
        <p class="font-display-lg text-4xl md:text-5xl text-action-lime font-bold mb-2">${esc(s.value)}</p>
        <p class="font-label-md text-label-md text-cream-soft uppercase tracking-wider">${esc(s.label)}</p>
      </div>`
    )
    .join('')
}

function renderFeatures(features, name = 'features') {
  const el = container(name)
  if (!el || !Array.isArray(features) || !features.length) return
  el.innerHTML = features
    .map(
      (f) => `
      <div class="bg-white p-8 rounded-2xl border border-slate-muted animate-on-scroll fade-in-up is-visible">
        <div class="w-12 h-12 rounded-full bg-action-lime/20 flex items-center justify-center mb-6">
          <span class="material-symbols-outlined text-action-lime" data-icon="${esc(f.iconName || 'star')}">${esc(f.iconName || 'star')}</span>
        </div>
        <h3 class="font-headline-lg text-[20px] font-semibold text-primary mb-3">${esc(f.title)}</h3>
        <p class="font-body-md text-body-md text-secondary">${esc(f.description)}</p>
      </div>`
    )
    .join('')
}

function renderClients(clients, heading) {
  const label = document.querySelector('[data-cms="clientsHeading"]')
  if (label && heading) label.textContent = heading
  const el = container('clients')
  if (!el || !Array.isArray(clients) || !clients.length) return
  el.innerHTML = clients
    .map(
      (c) =>
        `<span class="font-display-lg text-2xl md:text-3xl font-bold text-primary">${esc(c)}</span>`
    )
    .join('')
}

function renderServices(services) {
  const el = container('services')
  if (!el || !Array.isArray(services) || !services.length) return
  el.innerHTML = services
    .map(
      (s, i) => `
      <a class="bg-white rounded-2xl border border-slate-muted overflow-hidden card-hover group cursor-pointer flex flex-col animate-on-scroll fade-in-up is-visible${i % 3 === 1 ? ' delay-100' : i % 3 === 2 ? ' delay-200' : ''}" href="${esc((s.cta && s.cta.url) || '#')}">
        <div class="h-48 overflow-hidden relative">
          <img class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="${esc(s.title)}" src="${esc(s.image || '')}" ${s.image ? '' : 'style="display:none"'}/>
          <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
        <div class="p-6 flex-grow flex flex-col justify-between bg-white">
          <div>
            <h3 class="font-headline-lg text-headline-lg-mobile text-primary mb-2">${esc(s.title)}</h3>
            <p class="font-body-md text-body-md text-secondary">${esc(s.shortDescription)}</p>
          </div>
          <div class="mt-4 flex justify-between items-center">
            <span class="material-symbols-outlined text-action-lime" data-icon="${esc(s.iconName || 'restaurant')}">${esc(s.iconName || 'restaurant')}</span>
            <span class="text-action-lime font-label-md text-[12px] opacity-0 group-hover:opacity-100 transition-opacity">${esc((s.cta && s.cta.label) || 'Learn More')} &#8594;</span>
          </div>
        </div>
      </a>`
    )
    .join('')
}


async function init() {
  const page = getPageName()

  // Global settings run on every page.
  await applyGlobalSettings()

  // Dynamic collections, fetched per page need.
  const needs = {
    services: !page || page === 'homepage',
    sectors: !page || page === 'homepage',
    testimonials: !page || page === 'homepage',
    plans: page === 'pricingPage',
    faqs: page === 'pricingPage',
  }

  if (needs.services) {
    const services = await sanityFetch(
      `*[_type == "service" && showOnHomepage == true] | order(order asc){
        title, shortDescription, iconName,
        "image": image.asset->url,
        "cta": cta{label, url}
      }`
    )
    renderServices(services)
  }

  if (needs.sectors) {
    const sectors = await sanityFetch(
      `*[_type == "sector"] | order(order asc){
        title, shortDescription, linkUrl,
        "image": image.asset->url
      }`
    )
    renderSectors(sectors)
  }

  if (needs.testimonials) {
    const testimonials = await sanityFetch(
      `*[_type == "testimonial"] | order(order asc){
        quote, authorName, authorRole, company, rating
      }`
    )
    renderTestimonials(testimonials)
  }

  if (needs.plans) {
    const plans = await sanityFetch(
      `*[_type == "pricingPlan"] | order(order asc){
        name, tagline, price, period, features, highlighted,
        "cta": cta{label, url}
      }`
    )
    renderPlans(plans)
  }

  if (needs.faqs) {
    const faqs = await sanityFetch(
      `*[_type == "faq"] | order(order asc){question, answer, category}`
    )
    renderFaqs(faqs)
  }

  if (!page) return

  const doc = await sanityFetch(
    `*[_type == $type][0]{
      ...,
      "contactImage": contactImage.asset->url,
      "storyImage": storyImage.asset->url,
      "heroImage": heroImage.asset->url
    }`,
    {type: page}
  )
  if (!doc) return
  await applyDocument(doc)

  if (page === 'homepage') {
    renderStats(doc.stats)
    renderFeatures(doc.features)
    renderClients(doc.clients, doc.clientsHeading)
    setHeroVideo(doc.heroVideoUrl)
  }
  if (page === 'aboutPage') {
    renderStats(doc.stats)
    renderFeatures(doc.missionCards, 'missionCards')
    renderFeatures(doc.values, 'values')
  }
  if (page === 'contactPage') {
    renderContactChannels(doc.contactChannels)
  }

  // Safety net: any CMS-rendered element with scroll-animation classes is
  // injected after the page's IntersectionObserver has run, so it would never
  // get revealed. Force-show anything still hidden inside CMS containers.
  document.querySelectorAll('[data-cms-list] .animate-on-scroll:not(.is-visible)').forEach((el) => {
    el.classList.add('is-visible')
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}


