// Preisvorschläge für die lokale Vorschau. Der Stripe-Server verwendet nur
// eigens freigegebene Price-IDs; diese Werte aktivieren keine Zahlung.
window.TheraViaPreise = Object.freeze({
  beratung: Object.freeze({1: 119, 3: 339, 6: 659, 10: 1069}),
  paarFamilie: Object.freeze({1: 169, 3: 479, 6: 899, 10: 1389}),
  format(betrag) {
    return new Intl.NumberFormat('de-DE', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0}).format(betrag);
  }
});
