
import Link from 'next/link';



const Footer = () => {

  return (

    <footer className="bg-dark text-white py-4 mt-auto">

      <div className="container">

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center">

          <div className="mb-3 mb-md-0">

            <h3 className="h5">EduChainMag</h3>

            <p className="text-muted">Explore the World of Web3 on Cardano!</p>

          </div>

          <div className="d-flex flex-column flex-md-row">

            <Link href="/about" className="text-white text-decoration-none me-3">

              About Us

            </Link>

            <Link href="/privacy" className="text-white text-decoration-none me-3">

              Privacy Policy

            </Link>

            <Link href="/terms" className="text-white text-decoration-none">

              Terms & Conditions

            </Link>

          </div>

        </div>

        <div className="mt-3 pt-3 border-top border-secondary d-flex flex-column flex-md-row justify-content-between align-items-center">

          <p className="text-muted small mb-0">

            © 2025 EduChainMag. Powered by Cardano.

          </p>

          <div className="d-flex mt-3 mt-md-0">

            {/* Add social media icons here */}

          </div>

        </div>

      </div>

    </footer>

  );

};



export default Footer;




