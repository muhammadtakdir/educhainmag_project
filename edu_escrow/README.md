# edu_escrow

Write validators in the `validators` folder, and supporting functions in the `lib` folder using `.ak` as a file extension.

```aiken
validator my_first_validator {
  spend(_datum: Option<Data>, _redeemer: Data, _output_reference: Data, _context: Data) {
    True
  }
}
```

## Building

```sh
aiken build
```

## Configuring

**aiken.toml**
```toml
[config.default]
network_id = 41
```

Or, alternatively, write conditional environment modules under `env`.

## Testing

You can write tests in any module using the `test` keyword. For example:

```aiken
use config

test foo() {
  config.network_id + 1 == 42
}
```

To run all tests, simply do:

```sh
aiken check
```

To run only tests matching the string `foo`, do:

```sh
aiken check -m foo
```

## Documentation

If you're writing a library, you might want to generate an HTML documentation for it.

Use:

```sh
aiken docs
```

## Resources

Find more on the [Aiken's user manual](https://aiken-lang.org).

---

## Edu Escrow Validator

This workspace contains an example educational escrow validator at `validators/edu_escrow.ak`.

Ringkasan singkat:

- Student membayar jumlah (lovelace) ke script dengan datum `EduDatum`.
- Pada progress 50% mentor dapat mengambil 30% dari jumlah.
- Pada progress 100% mentor dapat mengambil sisa dengan pembagian 60% mentor / 40% platform.

Menjalankan pemeriksaan & tes:

```powershell
# compile & run tests
aiken check
```

Contoh penggunaan (MeshJS - pseudocode):

```js
// PSEUDO-CODE: ilustrasi alur saja
// 1) Buat datum dan redeemer sesuai struktur EduDatum/EduRedeemer
// 2) Siapkan UTXO script yang akan di-spend
// 3) Bangun transaksi yang mengeluarkan output ke mentor dan output kembali ke script
// 4) Sertakan redeemer pada input script, tandatangani dengan kunci mentor, lalu submit

// NOTE: sesuaikan API Mesh/SDK yang Anda pakai (serialisasi datum/redeemer harus sesuai)
```

Perubahan pada repo ini:

- Bersihkan peringatan compiler (unused imports / variables)
- Perbaikan pembuatan `Value` menggunakan `from_lovelace` dan penggunaan `dict.empty` / `interval.everything` untuk test transactions

Jika ingin, saya dapat menambahkan contoh serialisasi CBOR untuk datum/redeemer atau skrip helper untuk membangun transaksi off-chain.
