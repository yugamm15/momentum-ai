export default function MomentumLogo({ className = "w-8 h-8" }) {
  return (
    <img
      src="/logo.png"
      alt="Moméntum Logo"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
