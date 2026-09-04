// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Badge,
	Button,
	Dialog,
	Empty,
	Input,
	Loader,
	Select,
	Text,
	useKumoToastManager,
} from "@cloudflare/kumo";
import { EnvelopeIcon, PlusIcon, TrashIcon, TrayIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router";
import api from "~/services/api";
import {
	useCreateMailbox,
	useDeleteMailbox,
	useMailboxes,
} from "~/queries/mailboxes";
import { queryKeys } from "~/queries/keys";

export function meta() {
	return [{ title: "Agentic Email" }];
}

export default function HomeRoute() {
	const toastManager = useKumoToastManager();
	const { data: mailboxes = [], refetch: refetchMailboxes, isFetched: mailboxesFetched } = useMailboxes({
		refetchInterval: 30_000,
	});
	const createMailbox = useCreateMailbox();
	const deleteMailbox = useDeleteMailbox();

	const { data: configData } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
		staleTime: Infinity, // config rarely changes
	});

	const domains = configData?.domains ?? [];
	const emailAddresses = configData?.emailAddresses ?? [];

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [emailInput, setEmailInput] = useState("");
	const [selectedDomain, setSelectedDomain] = useState("");
	const [newName, setNewName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [mailboxToDelete, setMailboxToDelete] = useState<{
		id: string;
		email: string;
	} | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Set default domain when config loads
	useEffect(() => {
		if (domains.length > 0 && !selectedDomain) {
			setSelectedDomain(domains[0]);
		}
	}, [domains, selectedDomain]);

	// Auto-create mailboxes from config (run once when both data sources are ready)
	const autoCreateDone = useRef(false);
	useEffect(() => {
		if (autoCreateDone.current) return;
		if (emailAddresses.length === 0 || !mailboxesFetched) return;
		const existingEmails = new Set(
			mailboxes.map((m) => m.email.toLowerCase()),
		);
		const toCreate = emailAddresses.filter(
			(addr) => !existingEmails.has(addr.toLowerCase()),
		);
		if (toCreate.length === 0) {
			autoCreateDone.current = true;
			return;
		}
		autoCreateDone.current = true;
		let cancelled = false;
		Promise.all(
			toCreate.map((addr) => {
				const localPart = addr.split("@")[0] || addr;
				return api.createMailbox(addr, localPart).catch(() => {});
			}),
		).then(() => { if (!cancelled) refetchMailboxes(); });
		return () => { cancelled = true; };
	}, [emailAddresses, mailboxes, refetchMailboxes]);

	const handleCreate = async (e: FormEvent) => {
		e.preventDefault();
		setCreateError(null);
		
		let email = "";
		const trimmedInput = emailInput.trim();

		if (domains.length > 0) {
			if (!trimmedInput || !selectedDomain) {
				setCreateError("Please fill in all fields");
				return;
			}
			email = `${trimmedInput}@${selectedDomain}`;
		} else {
			if (!trimmedInput) {
				setCreateError("Please enter an email address");
				return;
			}
			if (!trimmedInput.includes("@")) {
				setCreateError("Please enter a valid full email address");
				return;
			}
			email = trimmedInput;
		}

		const name = newName || trimmedInput.split('@')[0];
		setIsCreating(true);
		try {
			await createMailbox.mutateAsync({ email, name });
			toastManager.add({ title: "Mailbox created successfully!" });
			setIsCreateOpen(false);
			setEmailInput("");
			setNewName("");
		} catch (err: unknown) {
			const message = (err instanceof Error ? err.message : null) || "Failed to create mailbox";
			setCreateError(message);
		} finally {
			setIsCreating(false);
		}
	};

	const handleDelete = async () => {
		if (!mailboxToDelete) return;
		setIsDeleting(true);
		try {
			await deleteMailbox.mutateAsync(mailboxToDelete.id);
			toastManager.add({ title: "Mailbox deleted" });
			setIsDeleteOpen(false);
			setMailboxToDelete(null);
		} catch {
			toastManager.add({ title: "Failed to delete mailbox", variant: "error" });
		} finally {
			setIsDeleting(false);
		}
	};

	const [searchQuery, setSearchQuery] = useState("");

	const isConfigured = emailAddresses.length > 0;

	const mailboxMap = useMemo(() => {
		const map = new Map<string, (typeof mailboxes)[number]>();
		for (const m of mailboxes) {
			map.set(m.email.toLowerCase(), m);
		}
		return map;
	}, [mailboxes]);

	const allAccounts = useMemo(() => {
		if (isConfigured) {
			return emailAddresses.map((addr) => {
				const found = mailboxMap.get(addr.toLowerCase());
				return {
					id: addr,
					email: addr,
					name: addr.split("@")[0] || addr,
					unreadCount: found?.unreadCount ?? 0,
				};
			});
		}
		return mailboxes;
	}, [isConfigured, emailAddresses, mailboxMap, mailboxes]);

	const accounts = useMemo(() => {
		if (!searchQuery.trim()) return allAccounts;
		const q = searchQuery.toLowerCase().trim();
		return allAccounts.filter((acc) => acc.email.toLowerCase().includes(q));
	}, [allAccounts, searchQuery]);

	const isLoading = !configData;

	return (
		<div className="min-h-screen bg-kumo-recessed">
			<div className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-16">
				<div className="mb-6">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2.5">
							<h1 className="text-2xl font-bold text-kumo-default">Mailboxes</h1>
							{allAccounts.length > 0 && (
								<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-kumo-fill text-kumo-subtle">
									{allAccounts.length}
								</span>
							)}
						</div>
						{!isConfigured && (
							<Button
								variant="primary"
								size="sm"
								icon={<PlusIcon size={16} />}
								onClick={() => setIsCreateOpen(true)}
							>
								New Mailbox
							</Button>
						)}
					</div>
					{domains.length > 0 && (
						<p className="text-sm text-kumo-subtle mt-1">
							{domains.join(", ")}
						</p>
					)}
					{allAccounts.length > 5 && (
						<div className="mt-4">
							<Input
								placeholder="Filter mailboxes by email address..."
								size="sm"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								aria-label="Filter mailboxes"
							/>
						</div>
					)}
				</div>

				{isLoading ? (
					<div className="flex justify-center py-20">
						<Loader size="lg" />
					</div>
				) : accounts.length > 0 ? (
					<div className="rounded-xl border border-kumo-line bg-kumo-base overflow-hidden">
						{accounts.map((account, idx) => (
							<RouterLink
								key={account.id}
								to={`/mailbox/${account.id}`}
								className={`group flex items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-kumo-tint ${
									idx > 0 ? "border-t border-kumo-line" : ""
								}`}
							>
								<TrayIcon
									size={18}
									weight="regular"
									className="text-kumo-subtle shrink-0 group-hover:text-kumo-brand transition-colors"
								/>
								<span className="text-sm font-medium text-kumo-default truncate flex-1">
									{account.email}
								</span>
								{account.unreadCount != null && account.unreadCount > 0 && (
									<Badge variant="secondary" className="shrink-0 font-semibold">
										{account.unreadCount}
									</Badge>
								)}
								{!isConfigured && (
									<Button
										variant="ghost"
										size="sm"
										shape="square"
										icon={<TrashIcon size={16} />}
										aria-label={`Delete mailbox ${account.email}`}
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setMailboxToDelete({
												id: account.id,
												email: account.email,
											});
											setIsDeleteOpen(true);
										}}
									/>
								)}
							</RouterLink>
						))}
					</div>
				) : (
					<div className="rounded-xl border border-kumo-line bg-kumo-base py-16 px-6">
						<div className="flex flex-col items-center text-center">
							<div className="mb-4">
								<EnvelopeIcon
									size={48}
									weight="thin"
									className="text-kumo-subtle"
								/>
							</div>
							<h3 className="text-base font-semibold text-kumo-default mb-1.5">
								No mailboxes yet
							</h3>
							<p className="text-sm text-kumo-subtle max-w-sm mb-5">
								{isConfigured
									? "Your email routing is configured but no mailboxes have been created yet. They will appear here automatically."
									: "Create a mailbox to start sending and receiving emails with your domain."}
							</p>
							{!isConfigured && (
								<Button
									variant="primary"
									icon={<PlusIcon size={16} />}
									onClick={() => setIsCreateOpen(true)}
								>
									Create Mailbox
								</Button>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Create Dialog */}
			<Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-5">
						Create New Mailbox
					</Dialog.Title>
					<form onSubmit={handleCreate} className="space-y-4">
						{createError && (
							<Text variant="error" size="sm">
								{createError}
							</Text>
						)}
						<div>
							<span className="text-sm font-medium text-kumo-default mb-1.5 block">
								Email Address
							</span>
							<div className="flex items-center gap-2">
								{domains.length > 0 ? (
									<>
										<div className="flex-1">
											<Input
												aria-label="Address prefix"
												placeholder="info"
												size="sm"
												value={emailInput}
												onChange={(e) => setEmailInput(e.target.value)}
												required
											/>
										</div>
										<span className="text-sm text-kumo-subtle">@</span>
										{domains.length > 1 ? (
											<div className="flex-1">
												<Select
													aria-label="Domain"
													value={selectedDomain}
													onValueChange={(value) => {
														if (value) setSelectedDomain(value);
													}}
												>
													{domains.map((d) => (
														<Select.Option key={d} value={d}>
															{d}
														</Select.Option>
													))}
												</Select>
											</div>
										) : (
											<span className="text-sm text-kumo-subtle">
												{selectedDomain || "no domain"}
											</span>
										)}
									</>
								) : (
									<div className="flex-1">
										<Input
											aria-label="Email address"
											placeholder="info@yourdomain.com"
											type="email"
											size="sm"
											value={emailInput}
											onChange={(e) => setEmailInput(e.target.value)}
											required
										/>
									</div>
								)}
							</div>
						</div>
						<Input
							label="Display Name (optional)"
							placeholder="Info"
							size="sm"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
						<div className="flex justify-end gap-2 pt-2">
							<Dialog.Close
								render={(props) => (
									<Button {...props} variant="secondary" size="sm">
										Cancel
									</Button>
								)}
							/>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								loading={isCreating}
								disabled={domains.length > 0 && !selectedDomain}
							>
								Create
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>

			{/* Delete Dialog */}
			<Dialog.Root
				open={isDeleteOpen}
				onOpenChange={(open) => {
					setIsDeleteOpen(open);
					if (!open) setMailboxToDelete(null);
				}}
			>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-2">
						Delete Mailbox
					</Dialog.Title>
					<Dialog.Description className="text-kumo-subtle text-sm mb-5">
						Are you sure you want to delete{" "}
						<strong className="text-kumo-default">
							{mailboxToDelete?.email}
						</strong>
						? This action cannot be undone.
					</Dialog.Description>
					<div className="flex justify-end gap-2">
						<Dialog.Close
							render={(props) => (
								<Button {...props} variant="secondary" size="sm">
									Cancel
								</Button>
							)}
						/>
						<Button
							variant="destructive"
							size="sm"
							loading={isDeleting}
							onClick={handleDelete}
						>
							Delete
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}
