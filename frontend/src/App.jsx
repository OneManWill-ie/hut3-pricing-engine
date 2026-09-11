import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const SESSION_KEY = 'pricing_session_uuid';
const USER_KEY = 'pricing_session_user';

const gbp = (pence) => `£${(pence / 100).toFixed(2)}`;

export default function App() {
  const [cart, setCart] = useState([]);
  const [items, setItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [pricing, setPricing] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState(null);
  const [sessionUuid, setSessionUuid] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(SESSION_KEY) || '';
  });
  const [username, setUsername] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(USER_KEY) || '';
  });
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' });

  useEffect(() => {
    if (sessionUuid) {
      localStorage.setItem(SESSION_KEY, sessionUuid);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [sessionUuid]);

  useEffect(() => {
    if (username) {
      localStorage.setItem(USER_KEY, username);
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [username]);

  const loadItems = () =>
    fetch(`${API_URL}/api/items`)
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setError('Could not reach the API'));

  const loadCart = () =>
    fetch(`${API_URL}/api/cart`)
      .then((r) => r.json())
      .then((items) => {
        setCart(items);
        setQuantities(Object.fromEntries(items.map((item) => [item.id, item.quantity])));
      })
      .catch(() => setError('Could not reach the API'));

  const loadPricing = (code = '') => {
    fetch(`${API_URL}/api/price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupon_code: code || undefined }),
    })
      .then((r) => r.json())
      .then(setPricing)
      .catch(() => setError('Could not reach the API'));
  };

  useEffect(() => {
    loadItems();
    loadCart();
    loadPricing();
  }, []);

  const applyCoupon = (e) => {
    e.preventDefault();
    loadPricing(couponCode);
  };

  const getAuthHeaders = (includeJson = false) => {
    const headers = {};

    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }

    if (sessionUuid) {
      headers['x-session-uuid'] = sessionUuid;
    }

    return headers;
  };

  const login = async (e) => {
    e.preventDefault();
    setError(null);

    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm),
    });

    if (!response.ok) {
      const result = await response.json();
      setError(result.error || 'Could not log in');
      return;
    }

    const result = await response.json();
    setSessionUuid(result.session_uuid);
    setUsername(result.user.username);
    setLoginForm({ username: '', password: '' });
  };

  const logout = () => {
    setSessionUuid('');
    setUsername('');
    setError(null);
  };

  const addItemToCart = async (itemId) => {
    if (!sessionUuid) {
      setError('Please log in before adding items to the cart');
      return;
    }

    const response = await fetch(`${API_URL}/api/cart`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ item_id: itemId, quantity: 1 }),
    });

    if (!response.ok) {
      const result = await response.json();
      setError(result.error || 'Could not add the item to the cart');
      return;
    }

    loadCart();
    loadPricing(couponCode);
  };

  const removeItem = async (id) => {
    const response = await fetch(`${API_URL}/api/cart/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const result = await response.json();
      setError(result.error || 'Could not remove the cart item');
      return;
    }

    loadCart();
    loadPricing(couponCode);
  };

  const updateItem = async (id) => {
    const response = await fetch(`${API_URL}/api/cart/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ quantity: quantities[id] }),
    });

    if (!response.ok) {
      const result = await response.json();
      setError(result.error || 'Could not update the cart');
      return;
    }

    loadCart();
    loadPricing(couponCode);
  };

  if (error) return <p style={{ fontFamily: 'sans-serif', color: 'crimson' }}>{error}</p>;

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 550, margin: '2rem auto' }}>
      {sessionUuid ? (
        <div style={{ marginBottom: '1rem' }}>
          <strong>Logged in as {username}</strong>
          <button onClick={logout} style={{ marginLeft: '0.75rem' }}>
            Log out
          </button>
        </div>
      ) : (
        <form onSubmit={login} style={{ marginBottom: '1rem' }}>
          <h2>Log in</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            />
            <button type="submit">Log in</button>
          </div>
        </form>
      )}

      <h2>Shop</h2>
      <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.35rem 0',
            }}
          >
            <span>
              {item.name} ({gbp(item.unit_price_pence)})
            </span>
            <button onClick={() => addItemToCart(item.id)}>Add to cart</button>
          </li>
        ))}
      </ul>

      <h1>Cart</h1>

      {cart.length === 0 && <p>Your cart is empty.</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {cart.map((item) => (
          <li
            key={item.id}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}
          >
            <span>
              {item.name} ({gbp(item.unit_price_pence)} each)
            </span>
            <span>
              <input
                type="number"
                min="1"
                step="1"
                value={quantities[item.id] ?? item.quantity}
                onChange={(e) =>
                  setQuantities({ ...quantities, [item.id]: Number(e.target.value) })
                }
                aria-label={`Quantity for ${item.name}`}
                style={{ width: '3rem' }}
              />{' '}
              <button onClick={() => updateItem(item.id)}>Update</button>{' '}
              {gbp(item.unit_price_pence * item.quantity)}{' '}
              <button onClick={() => removeItem(item.id)}>remove</button>
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={applyCoupon} style={{ margin: '1rem 0' }}>
        <input
          placeholder="Coupon code"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
        />
        <button type="submit">Apply</button>
      </form>

      {pricing && (
        <div>
          <h2>Breakdown</h2>
          <p>Subtotal: {gbp(pricing.subtotal_pence)}</p>

          {pricing.discounts.length === 0 && <p>No discounts applied.</p>}
          <ul>
            {pricing.discounts.map((d, i) => (
              <li key={i}>
                {d.description}: -{gbp(d.amount_pence)}
              </li>
            ))}
          </ul>

          {pricing.coupon_error && <p style={{ color: 'crimson' }}>{pricing.coupon_error}</p>}

          <h3>Total: {gbp(pricing.total_pence)}</h3>
        </div>
      )}
    </div>
  );
}
