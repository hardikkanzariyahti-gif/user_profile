declare function validateCreateUserInput(body: any): {
    name: any;
    email: any;
    password: any;
};
declare function validateUpdateUserInput(body: any): any;
declare function validateLoginInput(body: any): {
    email: any;
    password: any;
};
export { validateCreateUserInput, validateUpdateUserInput, validateLoginInput };
//# sourceMappingURL=userValidators.d.ts.map