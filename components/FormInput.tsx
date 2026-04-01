import React, { useState } from 'react';
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
}: FormInputProps) {
	const [open, setOpen] = useState(false);
	const items = options.map(opt => ({ label: opt, value: opt }));

	return (
		<View style={styles.container}>
			<Text style={styles.label}>
				{label} {required && <Text style={{ color: 'red' }}>*</Text>}
			</Text>
				       {type === 'picker' ? (
					       <View style={styles.pickerContainer}>
						       <DropDownPicker
							       open={open}
							       value={value}
							       items={items}
							       setOpen={setOpen}
							       setValue={callback => {
								       const newValue = typeof callback === 'function' ? callback(value) : callback;
								       onChangeText(newValue);
							       }}
							       setItems={() => {}}
							       placeholder={placeholder || 'Select...'}
							       disabled={!editable}
							       style={styles.picker}
							       dropDownContainerStyle={{ borderColor: '#ccc' }}
							       zIndex={1000}
							       listMode="MODAL"
							       modalProps={{
								       presentationStyle: 'formSheet',
							       }}
							       modalContentContainerStyle={styles.modalContentContainer}
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
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
       container: { marginBottom: 16 },
       label: { fontWeight: '600', marginBottom: 4 },
       input: {
	       borderWidth: 1,
	       borderColor: '#ccc',
	       borderRadius: 6,
	       padding: 10,
	       fontSize: 16,
	       backgroundColor: '#fff',
       },
       multiline: { minHeight: 60, textAlignVertical: 'top' },
       disabled: { backgroundColor: '#f2f2f2', color: '#888' },
       pickerContainer: {
	       zIndex: 1000,
       },
       picker: {
	       borderColor: '#ccc',
	       borderRadius: 6,
	       minHeight: 48,
	       fontSize: 16,
       },
       modalContentContainer: {
	       maxHeight: 400,
	       minHeight: 200,
	       alignSelf: 'center',
	       width: '90%',
	       borderRadius: 16,
	       overflow: 'hidden',
       },
});
