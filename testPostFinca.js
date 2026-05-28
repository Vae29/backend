(
async () => {
  try {
    const res = await fetch('http://localhost:3000/api/fincas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Prueba', ubicacion: 'Ubicacion' }),
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (err) {
    console.error('Error:', err);
  }
})();
