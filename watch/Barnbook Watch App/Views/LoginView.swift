import SwiftUI

struct LoginView: View {
    @Bindable var viewModel: AuthViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Text("Barnbook")
                    .font(.headline)
                    .foregroundStyle(.green)

                TextField("Server URL", text: $viewModel.serverURL)
                    .textContentType(.URL)
                    .autocorrectionDisabled()

                TextField("Email", text: $viewModel.email)
                    .textContentType(.emailAddress)
                    .autocorrectionDisabled()

                SecureField("Password", text: $viewModel.password)
                    .textContentType(.password)

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.caption2)
                        .foregroundStyle(.red)
                }

                Button {
                    Task { await viewModel.login() }
                } label: {
                    if viewModel.isLoading {
                        ProgressView()
                    } else {
                        Text("Sign In")
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(viewModel.isLoading)
            }
            .padding()
        }
    }
}
