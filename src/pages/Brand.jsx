import { Link, useParams, useSearchParams } from 'react-router-dom'

import BrandTile from '../components/BrandTile.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import FilterBar from '../components/FilterBar.jsx'
import { AdireCloth, CoralAndBrass, DanfoBus, SheaJars } from '../components/Illustrations.jsx'
import Loading from '../components/Loading.jsx'
import ProductCard from '../components/ProductCard.jsx'
import useApi from '../hooks/useApi.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { isLightKit, kitStyle, readableOn } from '../lib/brandKit.js'
import NotFound from './NotFound.jsx'

const PAGE_DARK = '#111110'

// Brands with a drawing in their hero. Brands without one simply show the colour block and name.
const HERO_ART = { danfo: DanfoBus, elu: AdireCloth, ivie: CoralAndBrass, kade: SheaJars }

function BrandHero({ brand }) {
  const Art = HERO_ART[brand.slug]
  const striped = brand.slug === 'danfo'
  const classes = ['brand-hero', striped && 'brand-hero--striped', isLightKit(brand) && 'brand-hero--light']
  return (
    <section className={classes.filter(Boolean).join(' ')} style={kitStyle(brand)}>
      <div className="brand-hero__text">
        <span className="label">{brand.descriptor} · {brand.city} · On Ọjà since 2026</span>
        <h1 className={`brand-hero__name kit-${brand.type_pairing}`}>{brand.name}</h1>
        <p className="brand-hero__tagline">{brand.tagline}</p>
      </div>
      {Art && <Art />}
      {striped && (
        <>
          <span className="brand-hero__stripe brand-hero__stripe--upper" />
          <span className="brand-hero__stripe brand-hero__stripe--lower" />
        </>
      )}
    </section>
  )
}

function BrandAbout({ brand, edits }) {
  // The kit's accent may be too dark to read on the page-dark panel, so pick the better colour.
  const highlight = readableOn(PAGE_DARK, brand)
  return (
    <section className="brand-about">
      <div className="brand-about__photo">Photo to come</div>
      <div className="brand-about__body">
        <span className="label" style={{ color: highlight }}>About the brand</span>
        <h2 className={`brand-about__slogan kit-${brand.type_pairing}`}>{brand.slogan}</h2>
        <p className="brand-about__story">{brand.story}</p>
        <div className="brand-about__edits">
          {edits.map((edit) => (
            <Link key={edit.slug} to={`/edits/${edit.slug}`} className="brand-about__edit">
              <span className="label">Also in {edit.title.replace(/^The /, 'the ')}</span>
              <span style={{ color: highlight }} aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Brand() {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const sort = params.get('sort') || 'featured'

  const query = new URLSearchParams({ brand: slug, sort })
  if (category) query.set('category', category)

  const brandRequest = useApi(`/brands/${slug}`)
  const brands = useApi('/brands')
  const products = useApi(`/products?${query}`)
  const brand = brandRequest.data
  usePageTitle(brand?.name)

  function update(name, value) {
    const next = new URLSearchParams(params)
    if (value && !(name === 'sort' && value === 'featured')) next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: true })
  }

  if (brandRequest.error?.status === 404) return <NotFound />
  const failed = [brandRequest, brands, products].find((r) => r.error)
  if (failed) return <ErrorState page onRetry={failed.reload} />
  if (!brand) return <Loading count={4} />

  // Chips are only worth showing when the brand sells in more than one category.
  const brandCategories = [...new Map(brand.products.map((p) => [p.category.slug, p.category])).values()]
  const otherBrands = (brands.data || []).filter((b) => b.slug !== slug)

  return (
    <div className="brand-page">
      <nav className="breadcrumb label" aria-label="Breadcrumb">
        <Link to="/">Ọjà</Link>
        <span aria-hidden="true">/</span>
        <Link to="/brands">Brands</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{brand.name}</span>
      </nav>

      <BrandHero brand={brand} />

      <FilterBar
        categories={brandCategories.length > 1 ? brandCategories : []}
        category={category}
        sort={sort}
        onChange={update}
      />

      {products.loading && <Loading count={8} />}
      {products.data && products.data.length === 0 && (
        <EmptyState
          text={category ? 'Nothing in that category right now.' : `Nothing from ${brand.name} is for sale right now.`}
          actionTo="/shop"
          actionLabel="Shop all"
        />
      )}
      {products.data && products.data.length > 0 && (
        <div className="product-grid product-grid--four brand-page__grid">
          {products.data.map((product) => <ProductCard key={product.slug} product={product} showBrand={false} />)}
        </div>
      )}

      <BrandAbout brand={brand} edits={brand.edits} />

      {otherBrands.length > 0 && (
        <section className="more-brands">
          <h2 className="display">
            More brands <span className="editorial">at Ọjà</span>
          </h2>
          <div className="brand-tiles brand-tiles--more">
            {otherBrands.map((b) => <BrandTile key={b.slug} brand={b} />)}
          </div>
        </section>
      )}
    </div>
  )
}
