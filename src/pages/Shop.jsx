import { useSearchParams } from 'react-router-dom'

import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import FilterBar from '../components/FilterBar.jsx'
import Loading from '../components/Loading.jsx'
import ProductCard from '../components/ProductCard.jsx'
import useApi from '../hooks/useApi.js'
import usePageTitle from '../hooks/usePageTitle.js'

// Filters live in the URL, so a filtered shop can be shared and refreshed.
export default function Shop() {
  usePageTitle('Shop all')
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const brand = params.get('brand') || ''
  const sort = params.get('sort') || 'featured'

  const query = new URLSearchParams({ sort })
  if (category) query.set('category', category)
  if (brand) query.set('brand', brand)

  const categories = useApi('/categories')
  const brands = useApi('/brands')
  const products = useApi(`/products?${query}`)

  function update(name, value) {
    const next = new URLSearchParams(params)
    if (value && !(name === 'sort' && value === 'featured')) next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: true })
  }

  const failed = [categories, brands, products].find((r) => r.error)
  const heading = (
    <h1 className="display listing__title">
      Shop <span className="editorial">all.</span>
    </h1>
  )

  return (
    <div className="listing">
      {heading}
      <FilterBar
        categories={categories.data || []}
        brands={brands.data || []}
        category={category}
        brand={brand}
        sort={sort}
        onChange={update}
      />
      {failed && <ErrorState onRetry={failed.reload} />}
      {!failed && products.loading && <Loading count={8} />}
      {products.data && products.data.length === 0 && (
        <EmptyState text="Nothing matches those filters yet." actionTo="/shop" actionLabel="Clear filters" />
      )}
      {products.data && products.data.length > 0 && (
        <>
          <p className="listing__count label">{products.data.length} pieces</p>
          <div className="product-grid product-grid--four">
            {products.data.map((product) => <ProductCard key={product.slug} product={product} />)}
          </div>
        </>
      )}
    </div>
  )
}
