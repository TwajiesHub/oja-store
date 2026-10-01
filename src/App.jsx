import { Route, Routes } from 'react-router-dom'

import Layout from './components/Layout.jsx'
import Bag from './pages/Bag.jsx'
import Brand from './pages/Brand.jsx'
import Brands from './pages/Brands.jsx'
import ComingSoon from './pages/ComingSoon.jsx'
import Edit from './pages/Edit.jsx'
import Edits from './pages/Edits.jsx'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'
import Product from './pages/Product.jsx'
import Shop from './pages/Shop.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="brands" element={<Brands />} />
        <Route path="brands/:slug" element={<Brand />} />
        <Route path="products/:slug" element={<Product />} />
        {/* These arrive in later milestones. */}
        <Route path="edits" element={<Edits />} />
        <Route path="edits/:slug" element={<Edit />} />
        <Route path="bag" element={<Bag />} />
        <Route path="orders" element={<ComingSoon title="Your orders" />} />
        <Route path="privacy" element={<ComingSoon title="Privacy" />} />
        <Route path="terms" element={<ComingSoon title="Terms" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
