import SwiftUI

struct HorsePickerView: View {
    @Bindable var viewModel: HorseSelectionViewModel
    var onSelect: (Horse) -> Void
    var onSettings: () -> Void

    var body: some View {
        List {
            if viewModel.isLoading {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
            } else if let error = viewModel.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            } else {
                ForEach(viewModel.horses) { horse in
                    Button {
                        onSelect(horse)
                    } label: {
                        HStack {
                            Text(horse.name)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Select Horse")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    onSettings()
                } label: {
                    Image(systemName: "gear")
                }
            }
        }
        .task {
            await viewModel.fetchHorses()
        }
    }
}
