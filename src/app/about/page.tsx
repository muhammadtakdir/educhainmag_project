export default function AboutPage() {
  return (
    <div className="container mt-4">
      <h1 className="text-center mb-4">Tentang Kami</h1>

      <div className="card bg-dark text-white shadow mx-auto" style={{ maxWidth: '800px' }}>
        <div className="card-body">
          <p className="card-text lead mb-4">
            EduChainMag adalah platform edukasi interaktif yang didedikasikan untuk membuka pintu dunia Web3 Cardano bagi audiens berbahasa Indonesia.
            Misi kami adalah menyediakan materi pembelajaran berkualitas tinggi, mudah diakses, dan relevan untuk membantu Anda menjadi ahli di ekosistem blockchain yang inovatif ini.
          </p>
          <p className="card-text mb-4">
            Kami percaya bahwa pendidikan adalah kunci untuk adopsi massal teknologi blockchain. Oleh karena itu, kami fokus pada:
          </p>
          <ul className="list-group list-group-flush mb-4">
            <li className="list-group-item bg-dark text-white">
              <strong>Pembelajaran Interaktif:</strong> Modul kami dirancang dengan kuis dan latihan praktis untuk pengalaman belajar yang mendalam.
            </li>
            <li className="list-group-item bg-dark text-white">
              <strong>Sertifikat On-chain:</strong> Dapatkan bukti digital tak terbantahkan (NFT/SBT) atas pencapaian Anda, yang tersimpan aman di blockchain Cardano.
            </li>
            <li className="list-group-item bg-dark text-white">
              <strong>Materi Bahasa Indonesia:</strong> Pahami konsep-konsep kompleks tanpa hambatan bahasa.
            </li>
            <li className="list-group-item bg-dark text-white">
              <strong>Fokus Cardano:</strong> Menjadi ahli di salah satu blockchain paling terdesentralisasi dan berkelanjutan di dunia.
            </li>
          </ul>
          <p className="card-text">
            Bergabunglah dengan komunitas EduChainMag dan mulailah perjalanan Anda menuju penguasaan Web3 Cardano hari ini!
          </p>
        </div>
      </div>
    </div>
  );
}
