import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
	return [
		{ title: "Login - Agentic Email" },
		{ name: "description", content: "Secure Access to Agentic Email" },
	];
};

export default function LoginPage() {
	const navigate = useNavigate();

	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError("");
		setIsSubmitting(true);
		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password }),
			});
			
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as any;
				setError(data.error || "Invalid credentials");
				setIsSubmitting(false);
				return;
			}
			
			// Force a full page reload so that the server-side router picks up the new cookie
			// and allows rendering the home route rather than hitting the middleware redirect
			window.location.href = "/";
		} catch (err) {
			setError("Network error. Please try again.");
			setIsSubmitting(false);
		}
	};

	return (
		<div className="login-page">
			<div className="login-card">
				<div className="login-logo">
					<h1>Agentic Email</h1>
					<p className="login-subtitle">Secure Access</p>
				</div>

				<form onSubmit={handleSubmit} className="login-form">
					{error && <div className="login-error">{error}</div>}

					<div className="login-field">
						<label htmlFor="login-password" className="login-label">
							Password
						</label>
						<input
							id="login-password"
							type="password"
							className="login-input"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							autoComplete="current-password"
							autoFocus
							required
							minLength={4}
						/>
					</div>

					<button
						type="submit"
						className="login-submit btn-primary"
						disabled={isSubmitting || !password}
					>
						{isSubmitting ? "Signing in..." : "Sign in"}
					</button>
				</form>
			</div>
		</div>
	);
}
