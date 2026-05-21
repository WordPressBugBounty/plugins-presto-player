import React, { useRef, useState, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import { DatePicker, Input } from '@bsf/force-ui';
import { Calendar, Trash2, ChevronDown } from 'lucide-react';
import { format } from '../utils/dateUtils';

function parseToDate(value) {
	if (!value) return null;
	if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
	const d = new Date(String(value).replace(' ', 'T'));
	return isNaN(d.getTime()) ? null : d;
}

export default function ChooseDate({
	chosenDate,
	onPickDate,
	placeholder,
	className = '',
	size = 'md',
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [dropdownStyle, setDropdownStyle] = useState({});
	const wrapperRef = useRef(null);
	const triggerRef = useRef(null);

	const selectedDate = parseToDate(chosenDate);

	useEffect(() => {
		function handleClickOutside(e) {
			if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
				setIsOpen(false);
			}
		}
		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [isOpen]);

	const displayValue = selectedDate
		? format(selectedDate, 'MMM dd, yyyy')
		: '';

	const handleDateSelect = (date) => {
		if (!date) return;
		const d = date instanceof Date ? date : new Date(date);
		if (isNaN(d.getTime())) return;
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		if (typeof onPickDate === 'function') {
			onPickDate(`${year}-${month}-${day}`);
		}
		setIsOpen(false);
	};

	const clearDate = (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (typeof onPickDate === 'function') {
			onPickDate('');
		}
		setIsOpen(false);
	};

	return (
		<div ref={wrapperRef} className={`relative ${className}`}>
			<div className="flex items-center gap-1">
				<div
					className="flex-1 cursor-pointer"
					ref={triggerRef}
					onClick={() => {
						if (!isOpen && triggerRef.current) {
							const rect = triggerRef.current.getBoundingClientRect();
							// DatePicker is ~340px tall; pad to 360 so we flip before the
							// last row clips against the viewport.
							const POPOVER_HEIGHT = 360;
							const GAP = 4;
							const spaceBelow = window.innerHeight - rect.bottom;
							const spaceAbove = rect.top;
							const flipUp =
								spaceBelow < POPOVER_HEIGHT + GAP &&
								spaceAbove > spaceBelow;
							const style = {
								position: 'fixed',
								left: rect.left,
								zIndex: 99999,
							};
							if (flipUp) {
								style.bottom = window.innerHeight - rect.top + GAP;
							} else {
								style.top = rect.bottom + GAP;
							}
							setDropdownStyle(style);
						}
						setIsOpen((prev) => !prev);
					}}
				>
					<Input
						size={size}
						value={displayValue}
						readOnly
						placeholder={placeholder || __('Select date', 'presto-player')}
						prefix={<Calendar size={16} />}
						suffix={<ChevronDown size={16} />}
						className="cursor-pointer"
					/>
				</div>
				{selectedDate && (
					<button
						type="button"
						onClick={clearDate}
						className="p-1.5 text-gray-400 hover:text-red-500 transition-colors border-0 bg-transparent outline-none shrink-0"
						title={__('Clear Date', 'presto-player')}
						aria-label={__('Clear Date', 'presto-player')}
					>
						<Trash2 size={16} aria-hidden="true" />
					</button>
				)}
			</div>

			{isOpen && (
				<div style={dropdownStyle} className="rounded-lg shadow-lg">
					<DatePicker
						selectionType="single"
						selected={selectedDate}
						onDateSelect={handleDateSelect}
						isFooter={false}
					/>
				</div>
			)}
		</div>
	);
}
