
import { Certificate } from '@/types';
import { siteConfig } from '@/config/site';

interface CertificateDisplayProps {
  certificate: Certificate;
}

const CertificateDisplay: React.FC<CertificateDisplayProps> = ({ certificate }) => {
  console.log("certificate.issuedAt type:", typeof certificate.issuedAt);
  console.log("certificate.issuedAt value:", certificate.issuedAt);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${certificate.onChainDetails.cardanoscanUrl}`;

  return (
    <div className="bg-white text-dark p-5 rounded-3 shadow-lg" style={{ fontFamily: 'serif' }}>
      <div className="text-center mb-4">
        <img src={siteConfig.logoUrl} alt="EduChainMag Logo" width="150" />
        <h1 className="h3 mt-3">Certificate of Completion</h1>
      </div>

      <div className="text-center my-5">
        <p className="lead">This certifies that</p>
        <h2 className="display-4" style={{ fontFamily: '\'Pinyon Script\', cursive' }}>{certificate.userName || 'Student Name'}</h2>
        <p className="lead mt-3">has successfully completed the module:</p>
        <h3 className="h4 fw-bold">{certificate.moduleTitle || certificate.moduleId}</h3>
      </div>

      <div className="row mt-5 align-items-end">
        <div className="col-4">
          <p className="text-center border-top border-dark pt-2 mb-0">[Project Lead Name]</p>
          <p className="text-center small text-muted">EduChainMag Lead</p>
        </div>
        <div className="col-4 text-center">
          <p className="mb-0">Issued on: {new Date(certificate.issuedAt instanceof Date ? certificate.issuedAt : (certificate.issuedAt && typeof certificate.issuedAt.toDate === 'function' ? certificate.issuedAt.toDate() : certificate.issuedAt)).toLocaleDateString()}</p>
        </div>
        <div className="col-4 text-center">
          <img src={qrCodeUrl} alt="Cardano Verification QR Code" />
          <p className="small mt-2 mb-0">Verified on the Cardano Network</p>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-8">
          <p className="text-center border-top border-dark pt-2 mb-0">[Instructor Name]</p>
          <p className="text-center small text-muted">Module Instructor</p>
        </div>
        <div className="col-4 text-center">
          <p className="small text-muted mb-0">Asset ID: {`${certificate.onChainDetails.policyId}.${certificate.onChainDetails.assetName}`}</p>
          <p className="small text-muted mb-0">TxID: {certificate.onChainDetails.txHash}</p>
        </div>
      </div>
    </div>
  );
};

export default CertificateDisplay;
