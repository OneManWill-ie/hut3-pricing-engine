#!/usr/bin/env python3
import argparse
import json
import os
import sys
import unittest
from urllib import error, request


class ApiClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def _request(self, method: str, path: str, payload=None):
        url = f"{self.base_url}{path}"
        data = None if payload is None else json.dumps(payload).encode("utf-8")

        req = request.Request(url, data=data, method=method)
        if payload is not None:
            req.add_header("Content-Type", "application/json")

        try:
            with request.urlopen(req, timeout=5) as resp:
                body = resp.read().decode("utf-8", errors="replace")
                return resp.status, body
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            return exc.code, body

    def get_json(self, path: str):
        status, body = self._request("GET", path)
        if not body:
            return status, None
        return status, json.loads(body)

    def post_json(self, path: str, payload):
        status, body = self._request("POST", path, payload)
        if not body:
            return status, None
        return status, json.loads(body)

    def patch_json(self, path: str, payload):
        status, body = self._request("PATCH", path, payload)
        if not body:
            return status, None
        return status, json.loads(body)

    def delete(self, path: str):
        status, body = self._request("DELETE", path)
        return status, body


class PricingApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = ApiClient(args.base_url)

    def test_get_cart(self):
        # Verifies the cart endpoint is reachable and returns a list of cart rows.
        status, data = self.client.get_json("/api/cart")
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_get_items(self):
        # Verifies the catalog endpoint returns item data with the expected fields.
        status, data = self.client.get_json("/api/items")
        self.assertEqual(status, 200)
        self.assertTrue(len(data) >= 1)
        self.assertIn("id", data[0])
        self.assertIn("name", data[0])
        self.assertIn("unit_price_pence", data[0])

    def test_add_update_delete_cart_item(self):
        # Covers the full cart lifecycle: add a line item, update its quantity, then delete it.
        status, items = self.client.get_json("/api/items")
        self.assertEqual(status, 200)
        self.assertTrue(len(items) >= 1)

        item_id = items[0]["id"]

        status, created = self.client.post_json("/api/cart", {"item_id": item_id, "quantity": 2})
        self.assertEqual(status, 201, created)
        self.assertEqual(created["item_id"], item_id)
        self.assertEqual(created["quantity"], 2)

        cart_id = created["id"]

        status, updated = self.client.patch_json(f"/api/cart/{cart_id}", {"quantity": 5})
        self.assertEqual(status, 200, updated)
        self.assertEqual(updated["quantity"], 5)

        status, result = self.client.delete(f"/api/cart/{cart_id}")
        self.assertEqual(status, 204, result)

    def test_price_endpoint_returns_breakdown(self):
        # Verifies the pricing endpoint returns the expected pricing structure and totals.
        status, data = self.client.post_json("/api/price", {"coupon_code": ""})
        self.assertEqual(status, 200, data)
        self.assertIn("subtotal_pence", data)
        self.assertIn("total_pence", data)
        self.assertIn("line_items", data)
        self.assertIn("discounts", data)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run API tests against the pricing engine.")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("API_BASE_URL", "http://localhost:4000"),
        help="Base URL for the API (default: http://localhost:4000)",
    )
    args = parser.parse_args()

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(PricingApiTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
