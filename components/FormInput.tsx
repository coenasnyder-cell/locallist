import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';

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
	const [open, setOpen] = useState(false);
	const items = useMemo(() => options.map((opt) => ({ label: opt, value: opt })), [options]);

	return (
		<View
			style={[
				styles.container,
				type === 'picker' && open ? { zIndex: dropdownZIndex, marginBottom: dropdownMaxHeight + 16 } : null,
			]}
		>
			<Text style={styles.label}>
				{label} {required && <Text style={styles.required}>*</Text>}
			</Text>
			{type === 'picker' ? (
				<View style={[styles.pickerContainer, open ? { zIndex: dropdownZIndex } : null]}>
					<DropDownPicker
						open={open}
						value={value || null}
						items={items}
						setOpen={setOpen}
						setValue={(callback) => {
							const nextValue = typeof callback === 'function' ? callback(value || null) : callback;
							onChangeText(typeof nextValue === 'string' ? nextValue : '');
						}}
						setItems={() => {}}
						placeholder={placeholder || 'Select...'}
						disabled={!editable}
						style={[styles.picker, open ? styles.pickerOpen : null, !editable ? styles.pickerDisabled : null]}
						textStyle={styles.pickerText}
						placeholderStyle={styles.pickerPlaceholder}
						dropDownContainerStyle={styles.dropdownMenu}
						listItemLabelStyle={styles.dropdownItemText}
						selectedItemContainerStyle={styles.selectedItemContainer}
						selectedItemLabelStyle={styles.selectedItemLabel}
						listMode="SCROLLVIEW"
						dropDownDirection="BOTTOM"
						maxHeight={dropdownMaxHeight}
						closeAfterSelecting
						autoScroll
						scrollViewProps={{ nestedScrollEnabled: true }}
						zIndex={dropdownZIndex}
					/>
				</View>
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
	container: { marginBottom: 16, zIndex: 1 },
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
	pickerContainer: {
		zIndex: 1,
	},
	picker: {
		borderColor: '#cbd5e1',
		borderRadius: 12,
		minHeight: 52,
		backgroundColor: '#fff',
	},
	pickerOpen: {
		borderColor: '#94a3b8',
		borderBottomLeftRadius: 0,
		borderBottomRightRadius: 0,
	},
	pickerDisabled: {
		backgroundColor: '#f8fafc',
		opacity: 0.75,
	},
	pickerText: {
		fontSize: 15,
		color: '#0f172a',
	},
	pickerPlaceholder: {
		color: '#94a3b8',
	},
	dropdownMenu: {
		borderColor: '#cbd5e1',
		borderTopWidth: 0,
		borderBottomLeftRadius: 12,
		borderBottomRightRadius: 12,
		backgroundColor: '#fff',
	},
	dropdownItemText: {
		fontSize: 15,
		color: '#0f172a',
	},
	selectedItemContainer: {
		backgroundColor: '#eff6ff',
	},
	selectedItemLabel: {
		color: '#1d4ed8',
		fontWeight: '700',
	},
});
