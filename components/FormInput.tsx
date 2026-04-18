import React, { useMemo, useState } from 'react';
import {
	FlatList,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

type FormInputProps = {
	label: string;
	value: string;
	onChangeText: (text: string) => void;
	required?: boolean;
	editable?: boolean;
	multiline?: boolean;
	keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
	type?: 'text' | 'picker';
	options?: string[];
	placeholder?: string;
	secureTextEntry?: boolean;
	dropdownZIndex?: number;
	dropdownMaxHeight?: number;
	maxLength?: number;
};

export default function FormInput({
	label,
	value,
	onChangeText,
	required,
	editable = true,
	multiline = false,
	keyboardType = 'default',
	type = 'text',
	options = [],
	placeholder,
	secureTextEntry = false,
	dropdownZIndex = 3000,
	dropdownMaxHeight = 220,
	maxLength,
}: FormInputProps) {
	const [pickerOpen, setPickerOpen] = useState(false);
	const items = useMemo(() => options.map((opt) => ({ label: opt, value: opt })), [options]);
	const selectedLabel = value || '';

	const handleSelect = (nextValue: string) => {
		onChangeText(nextValue);
		setPickerOpen(false);
	};

	return (
		<View style={styles.container}>
			<Text style={styles.label}>
				{label} {required && <Text style={styles.required}>*</Text>}
			</Text>
			{type === 'picker' ? (
				<>
					<TouchableOpacity
						style={[
							styles.pickerButton,
							pickerOpen ? styles.pickerButtonOpen : null,
							!editable ? styles.pickerDisabled : null,
						]}
						onPress={() => {
							if (editable) {
								setPickerOpen(true);
							}
						}}
						activeOpacity={0.85}
						disabled={!editable}
					>
						<Text
							style={[
								styles.pickerButtonText,
								!selectedLabel ? styles.pickerPlaceholder : null,
								!editable ? styles.disabledText : null,
							]}
							numberOfLines={1}
						>
							{selectedLabel || placeholder || 'Select...'}
						</Text>
						<Text style={styles.chevron}>{pickerOpen ? '▲' : '▼'}</Text>
					</TouchableOpacity>

					<Modal
						visible={pickerOpen}
						transparent
						animationType="fade"
						onRequestClose={() => setPickerOpen(false)}
					>
						<View style={[styles.modalOverlay, { zIndex: dropdownZIndex }]}>
							<Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)} />
							<View style={[styles.modalCard, { maxHeight: dropdownMaxHeight + 120 }]}>
								<View style={styles.modalHeader}>
									<Text style={styles.modalTitle}>{label}</Text>
									<TouchableOpacity onPress={() => setPickerOpen(false)} activeOpacity={0.85}>
										<Text style={styles.modalClose}>Close</Text>
									</TouchableOpacity>
								</View>
								<FlatList
									data={items}
									keyExtractor={(item) => item.value}
									showsVerticalScrollIndicator
									style={{ maxHeight: dropdownMaxHeight }}
									renderItem={({ item }) => {
										const isSelected = item.value === value;
										return (
											<TouchableOpacity
												style={[
													styles.optionRow,
													isSelected ? styles.selectedItemContainer : null,
												]}
												onPress={() => handleSelect(item.value)}
												activeOpacity={0.85}
											>
												<Text
													style={[
														styles.dropdownItemText,
														isSelected ? styles.selectedItemLabel : null,
													]}
												>
													{item.label}
												</Text>
											</TouchableOpacity>
										);
									}}
									ItemSeparatorComponent={() => <View style={styles.optionDivider} />}
								/>
							</View>
						</View>
					</Modal>
				</>
			) : (
				<TextInput
					style={[styles.input, multiline && styles.multiline, !editable && styles.disabled]}
					value={value}
					onChangeText={onChangeText}
					editable={editable}
					multiline={multiline}
					keyboardType={keyboardType}
					placeholder={placeholder}
					secureTextEntry={secureTextEntry}
					maxLength={maxLength}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { marginBottom: 16 },
	label: { fontWeight: '700', marginBottom: 6, color: '#334155' },
	required: { color: '#dc2626' },
	input: {
		borderWidth: 1,
		borderColor: '#cbd5e1',
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 12,
		fontSize: 16,
		backgroundColor: '#fff',
		color: '#0f172a',
	},
	multiline: { minHeight: 88, textAlignVertical: 'top' },
	disabled: { backgroundColor: '#f8fafc', color: '#94a3b8' },
	disabledText: {
		color: '#94a3b8',
	},
	pickerButton: {
		borderColor: '#cbd5e1',
		borderWidth: 1,
		borderRadius: 12,
		minHeight: 52,
		backgroundColor: '#fff',
		paddingHorizontal: 12,
		paddingVertical: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	pickerButtonOpen: {
		borderColor: '#94a3b8',
	},
	pickerDisabled: {
		backgroundColor: '#f8fafc',
		opacity: 0.75,
	},
	pickerButtonText: {
		fontSize: 15,
		color: '#0f172a',
		flex: 1,
		marginRight: 12,
	},
	pickerPlaceholder: {
		color: '#94a3b8',
	},
	chevron: {
		fontSize: 12,
		color: '#64748b',
	},
	dropdownItemText: {
		fontSize: 15,
		color: '#0f172a',
	},
	modalOverlay: {
		flex: 1,
		justifyContent: 'center',
		padding: 20,
	},
	modalBackdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(15, 23, 42, 0.35)',
	},
	modalCard: {
		backgroundColor: '#fff',
		borderRadius: 16,
		paddingVertical: 12,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderColor: '#cbd5e1',
	},
	modalHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 4,
		paddingBottom: 10,
	},
	modalTitle: {
		fontSize: 17,
		fontWeight: '700',
		color: '#0f172a',
	},
	modalClose: {
		fontSize: 14,
		fontWeight: '600',
		color: '#475569',
	},
	optionRow: {
		paddingHorizontal: 12,
		paddingVertical: 14,
		borderRadius: 10,
	},
	optionDivider: {
		height: 8,
	},
	selectedItemContainer: {
		backgroundColor: '#eff6ff',
	},
	selectedItemLabel: {
		color: '#1d4ed8',
		fontWeight: '700',
	},
});
