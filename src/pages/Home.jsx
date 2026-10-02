import { Link } from 'react-router-dom'

import BrandTile from '../components/BrandTile.jsx'
import Button from '../components/Button.jsx'
import EditTile from '../components/EditTile.jsx'
import ErrorState from '../components/ErrorState.jsx'
import Loading from '../components/Loading.jsx'
import ProductCard from '../components/ProductCard.jsx'
import useApi from '../hooks/useApi.js'
import usePageTitle from '../hooks/usePageTitle.js'

const NEW_IN_COUNT = 4

// One featured product from each of the first few brands, so "New in" shows variety.
function pickArrivals(featured) {
  const seen = new Set()
  const picks = []
  for (const product of featured) {
    if (!seen.has(product.brand.slug)) {
      seen.add(product.brand.slug)
      picks.push(product)
    }
  }
  return picks.slice(0, NEW_IN_COUNT)
}

// For each category, the brands that sell in it ("Danfo · Elú · oke").
function brandsByCategory(products) {
  const grouped = {}
  for (const product of products) {
    const names = (grouped[product.category.slug] ||= [])
    if (!names.includes(product.brand.name)) names.push(product.brand.name)
  }
  return grouped
}

function CategoryRows({ products }) {
  const byCategory = brandsByCategory(products)
  const categories = [...new Map(products.map((p) => [p.category.slug, p.category.name])).entries()]

  return categories.map(([slug, name]) => (
    <Link key={slug} to={`/shop?category=${slug}`} className="category-row">
      <span className="display category-row__name">{name}</span>
      <span className="category-row__side">
        <span className="label category-row__brands only-desktop">{byCategory[slug].join(' · ')}</span>
        <span className="category-row__arrow" aria-hidden="true">↗</span>
      </span>
    </Link>
  ))
}

function Hero() {
  return (
    <section className="hero">
      <span className="hero__eyebrow label">A market for made-in-Nigeria · Lagos</span>
      <h1 className="hero__headline display">
        The best of made‑in‑Nigeria, <span className="editorial">in one market.</span>
      </h1>
      <div className="hero__foot">
        <p className="hero__intro">
          <span className="only-desktop">
            Six independent Nigerian brands, from streetwear and adire to shea, coral, leather and aso-oke,
            curated into one store with one bag and one checkout.
          </span>
          <span className="only-phone">Six independent brands, one bag and one checkout.</span>
        </p>
        <div className="hero__actions">
          <Button to="/shop">SHOP ALL ↗</Button>
          <Link to="/edits" className="label text-link only-desktop">The edits</Link>
        </div>
      </div>
      <div className="cover-story">
        <span className="cover-story__label label">Cover story</span>
        <span className="cover-story__number label only-desktop">N° 01</span>
        <img
          className="cover-story__image"
          src="/images/products/cover-story-large.webp"
          srcSet="/images/products/cover-story.webp 800w, /images/products/cover-story-large.webp 928w"
          sizes="(min-width: 1200px) 33vw, 100vw"
          alt="A woman in an indigo adire wrap dress, a coral bead necklace and a tooled tan leather clutch, walking down a busy market street under bright umbrellas in late-afternoon light."
          width="928"
          height="1152"
          decoding="async"
        />
        <span className="cover-story__caption editorial">
          Wearing Elú,
          <br />
          Ivie and Kofa
        </span>
        <Link to="/edits/owambe" className="cover-story__link label text-link only-desktop">Shop the look ↗</Link>
      </div>
    </section>
  )
}

export default function Home() {
  usePageTitle('')
  const brands = useApi('/brands')
  const edits = useApi('/edits')
  const featured = useApi('/products?featured=true')
  const products = useApi('/products')

  const requests = [brands, edits, featured, products]
  if (requests.some((r) => r.error)) {
    return <ErrorState page onRetry={() => requests.forEach((r) => r.error && r.reload())} />
  }
  const loading = requests.some((r) => r.loading)

  return (
    <div className="home">
      <Hero />

      <section className="home-section home-section--ruled">
        <div className="home-section__head">
          <h2 className="display">
            Six brands. <span className="editorial">One bag.</span>
          </h2>
          <Link to="/brands" className="label text-link only-desktop">All brands ↗</Link>
        </div>
        {!loading && brands.data.length === 0 && <p className="home-section__empty">The brands are being added. Check back soon.</p>}
        {loading ? <Loading count={6} /> : (
          <div className="brand-tiles">
            {brands.data.map((brand) => <BrandTile key={brand.slug} brand={brand} />)}
          </div>
        )}
      </section>

      {!loading && (
        <section className="home-section home-section--edits">
          {edits.data.map((edit, index) => <EditTile key={edit.slug} edit={edit} number={index + 1} />)}
        </section>
      )}

      <section className="home-section home-section--ruled">
        <div className="home-section__head">
          <h2 className="display">
            New in<span className="only-desktop"> <span className="editorial">the market</span></span>
          </h2>
          <Link to="/shop" className="label text-link">
            Shop all<span className="only-desktop"> ↗</span>
          </Link>
        </div>
        {loading ? <Loading count={4} /> : (
          <div className="product-grid product-grid--four product-grid--arrivals">
            {pickArrivals(featured.data).map((product) => <ProductCard key={product.slug} product={product} />)}
          </div>
        )}
      </section>

      <section className="home-section category-rows">
        <span className="label category-rows__title">Shop by category</span>
        {!loading && <CategoryRows products={products.data} />}
      </section>

      <section className="promises only-desktop">
        <div className="promises__item">
          <span className="label">01 · Made here</span>
          <p>Every brand on Ọjà designs and makes its work in Nigeria.</p>
        </div>
        <div className="promises__item">
          <span className="label">02 · One checkout</span>
          <p>Shop six brands and pay once with Paystack: card, transfer or USSD.</p>
        </div>
        <div className="promises__item">
          <span className="label">03 · Delivered</span>
          <p>1–3 days across Lagos, and 3–5 days to the rest of Nigeria.</p>
        </div>
      </section>
    </div>
  )
}
