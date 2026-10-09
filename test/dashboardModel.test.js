import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCostTrendQuery, buildProductionTrendQuery } from '../models/dashboardModel.js';

test('production trend restricts active harvests to active crops in the selected farm', () => {
  const query = buildProductionTrendQuery();

  assert.match(query, /LEFT JOIN cosecha cc[\s\S]*ON date_trunc\('month', cc\.fecha_cosecha\) = generated_month/);
  assert.match(query, /AND COALESCE\(UPPER\(cc\.estado_registro\), ''\) = 'ACTIVO'/);
  assert.match(query, /EXISTS \([\s\S]*FROM cultivo cultivo_finca[\s\S]*cultivo_finca\.idfinca = \$1[\s\S]*cultivo_finca\.estado_registro/);
  assert.match(query, /GROUP BY generated_month[\s\S]*ORDER BY generated_month/);
  assert.doesNotMatch(query, /WHERE[\s\S]*cc\.estado_registro/);
});

test('cost trend filters the selected farm and active costs inside the left join', () => {
  const query = buildCostTrendQuery();

  assert.match(query, /LEFT JOIN costo co[\s\S]*ON date_trunc\('month', co\.fecha\) = generated_month/);
  assert.match(query, /AND co\.idfinca = \$1/);
  assert.match(query, /AND COALESCE\(UPPER\(co\.estado_registro\), ''\) = 'ACTIVO'/);
  assert.match(query, /COALESCE\(SUM\(co\.valor\), 0\)/);
  assert.match(query, /GROUP BY generated_month[\s\S]*ORDER BY generated_month/);
  assert.doesNotMatch(query, /WHERE[\s\S]*co\.(idfinca|estado_registro)/);
});